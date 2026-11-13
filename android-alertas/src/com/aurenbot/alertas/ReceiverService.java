package com.aurenbot.alertas;

import android.app.*;
import android.content.*;
import android.media.AudioAttributes;
import android.os.*;
import android.provider.Settings;
import java.io.IOException;
import java.security.SecureRandom;
import java.text.DateFormat;
import java.util.Date;

public final class ReceiverService extends Service {
    public static final int PORT=8765;
    public static volatile boolean running=false;
    public static volatile String lastError="";
    private static final String ACTIVE="receiver",SOUND="alerts_sound_v1",SILENT="alerts_silent_v1";
    private HttpReceiver http; private PowerManager.WakeLock wake;
    private final EventPolicy events=new EventPolicy();
    static android.content.SharedPreferences prefs(Context c) { return c.getSharedPreferences("auren_alertas",MODE_PRIVATE); }
    static synchronized String token(Context c) {
        String saved=prefs(c).getString("token",null);
        if(saved!=null)return saved;
        byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);StringBuilder s=new StringBuilder();
        for(byte b:bytes)s.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
        saved=s.toString();prefs(c).edit().putString("token",saved).commit();return saved;
    }
    static NotificationManager manager(Context c) { return (NotificationManager)c.getSystemService(NOTIFICATION_SERVICE); }
    static void channels(Context c) {
        NotificationChannel active=new NotificationChannel(ACTIVE,"Receptor ligado",NotificationManager.IMPORTANCE_LOW);
        active.setDescription("Mantém a conexão disponível para a extensão.");active.setSound(null,null);
        manager(c).createNotificationChannel(active);
        NotificationChannel sound=new NotificationChannel(SOUND,"Verificações com som",NotificationManager.IMPORTANCE_HIGH);
        sound.setDescription("Avisos quando o Auren precisa da sua resposta.");
        sound.setSound(Settings.System.DEFAULT_NOTIFICATION_URI,new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
        sound.enableVibration(true);sound.setVibrationPattern(new long[]{0,250,150,250});manager(c).createNotificationChannel(sound);
        NotificationChannel silent=new NotificationChannel(SILENT,"Verificações sem som",NotificationManager.IMPORTANCE_HIGH);
        silent.setSound(null,null);silent.enableVibration(false);manager(c).createNotificationChannel(silent);
    }
    static PendingIntent open(Context c) { return PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT); }
    static String channel(Context c) { return prefs(c).getBoolean("sound",true)?SOUND:SILENT; }
    static boolean alertsAllowed(Context c) {
        NotificationChannel channel=manager(c).getNotificationChannel(channel(c));
        return manager(c).areNotificationsEnabled() && channel!=null && channel.getImportance()!=NotificationManager.IMPORTANCE_NONE;
    }
    static void alert(Context c,String kind) {
        String text=kind.equals("teste")?"Este celular está pronto para receber os avisos da extensão.":kind.equals("sombra")?"O desafio de sombra apareceu. Abra o jogo pelo VNC para responder.":"Uma verificação apareceu no Auren. Abra o jogo pelo VNC e conclua manualmente.";
        Notification n=new Notification.Builder(c,channel(c)).setSmallIcon(R.drawable.ic_alert).setContentTitle(kind.equals("teste")?"AurenBot — teste":"AurenBot — precisa de você")
            .setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text)).setContentIntent(open(c)).setAutoCancel(true)
            .setOnlyAlertOnce(false).setCategory(Notification.CATEGORY_MESSAGE).setVisibility(Notification.VISIBILITY_PRIVATE).build();
        manager(c).notify(200,n);
    }
    @Override public void onCreate() { super.onCreate();channels(this); }
    private Notification persistent(String text) {
        PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,ReceiverService.class).setAction("STOP"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this,ACTIVE).setSmallIcon(R.drawable.ic_alert).setContentTitle("AurenBot Alertas ligado").setContentText(text)
            .setContentIntent(open(this)).setOngoing(true).setCategory(Notification.CATEGORY_SERVICE).addAction(new Notification.Action.Builder(null,"Parar",stop).build()).build();
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId) {
        if(intent!=null && "STOP".equals(intent.getAction())) { stopSelf();return START_NOT_STICKY; }
        try {
            if(Build.VERSION.SDK_INT>=29)startForeground(100,persistent("Recebendo avisos na porta "+PORT),android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            else startForeground(100,persistent("Recebendo avisos na porta "+PORT));
            if(http!=null)return START_STICKY;
            if(!alertsAllowed(this))throw new IllegalStateException("Permita as notificações do aplicativo e do canal de avisos.");
            http=new HttpReceiver(token(this),this::receive);http.start(PORT);
            PowerManager power=(PowerManager)getSystemService(POWER_SERVICE);
            wake=power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"AurenBot:Receiver");wake.acquire();
            running=true;lastError="";
            return START_STICKY;
        } catch(IOException | RuntimeException e) {
            lastError=e instanceof IOException?"Não consegui abrir a porta 8765. Confira se outro receptor já está usando essa porta.":"Não consegui manter o receptor: "+e.getMessage();
            stopSelf();return START_NOT_STICKY;
        }
    }
    private synchronized HttpReceiver.Reply receive(String body) {
        try {
            EventPolicy.Event e=EventPolicy.parse(body);
            if(!running||!alertsAllowed(this))return new HttpReceiver.Reply(503,"{\"ok\":false}");
            int result=events.accept(e.id,SystemClock.elapsedRealtime());
            if(result==429)return new HttpReceiver.Reply(429,"{\"ok\":false}");
            if(result==208)return new HttpReceiver.Reply(200,"{\"ok\":true,\"duplicado\":true}");
            try { alert(this,e.type); } catch(RuntimeException error) { events.rollback(e.id);return new HttpReceiver.Reply(503,"{\"ok\":false}"); }
            String label=e.type.equals("sombra")?"Desafio de sombra":"Verificação do Cloudflare";
            prefs(this).edit().putString("last",DateFormat.getDateTimeInstance(DateFormat.SHORT,DateFormat.MEDIUM).format(new Date())+" — "+label).apply();
            return new HttpReceiver.Reply(200,"{\"ok\":true}");
        } catch(org.json.JSONException e) { return new HttpReceiver.Reply(400,"{\"ok\":false}"); }
        catch(RuntimeException e) { return new HttpReceiver.Reply(503,"{\"ok\":false}"); }
    }
    @Override public void onDestroy() {
        running=false;if(http!=null)http.close();http=null;
        if(wake!=null&&wake.isHeld())wake.release();wake=null;
        stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
