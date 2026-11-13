package com.aurenbot.alertas;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.*;
import android.provider.Settings;
import android.text.method.PasswordTransformationMethod;
import android.view.*;
import android.widget.*;
import java.net.*;
import java.util.*;

public final class MainActivity extends Activity {
    private LinearLayout page; private TextView status,last; private Spinner addresses;
    private final Handler timer=new Handler(Looper.getMainLooper());
    private String pendingAction="";
    private final Runnable refresh=new Runnable(){public void run(){update();timer.postDelayed(this,2000);}};
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private TextView text(String s,int size,int color) {
        TextView v=new TextView(this);v.setText(s);v.setTextSize(size);v.setTextColor(color);v.setPadding(0,dp(8),0,dp(8));page.addView(v);return v;
    }
    private void heading(String s){text(s,20,Color.WHITE).setTypeface(null,Typeface.BOLD);}
    private Button button(String label,View.OnClickListener fn) {
        Button b=new Button(this);b.setText(label);b.setTextColor(Color.rgb(16,24,32));b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(213,183,121)));
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(52));lp.setMargins(0,dp(6),0,dp(6));page.addView(b,lp);b.setOnClickListener(fn);return b;
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);if(state!=null)pendingAction=state.getString("pendingAction","");ReceiverService.channels(this);
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);page.setPadding(dp(24),dp(24),dp(24),dp(32));page.setBackgroundColor(Color.rgb(16,24,32));scroll.addView(page);setContentView(scroll);
        text("RECEPTOR NO SEU ANDROID",12,Color.rgb(213,183,121));text("AurenBot Alertas",30,Color.WHITE).setTypeface(null,Typeface.BOLD);
        text("Receba um aviso quando o jogo precisar da sua resposta. Resolva a verificação manualmente pelo VNC.",16,0xffbbcad6);
        heading("1. Ligue o receptor");status=text("Receptor desligado.",16,0xffd5b779);
        button("Iniciar receptor",v->authorize("start"));button("Parar receptor",v->{stopService(new Intent(this,ReceiverService.class));status.setText("Encerrando receptor…");});
        Switch sound=new Switch(this);sound.setText("Aviso com som e vibração");sound.setTextColor(Color.WHITE);sound.setPadding(0,dp(16),0,dp(16));sound.setChecked(ReceiverService.prefs(this).getBoolean("sound",true));page.addView(sound);sound.setOnCheckedChangeListener((v,checked)->ReceiverService.prefs(this).edit().putBoolean("sound",checked).apply());
        button("Testar notificação neste celular",v->authorize("test"));
        heading("2. Conecte a extensão");text("Conecte o celular e a VPS ao Tailscale. Escolha abaixo o IP Tailscale deste celular (100.x.x.x). Na mesma rede Wi-Fi, também pode usar o IP local.",15,0xffbbcad6);
        addresses=new Spinner(this);page.addView(addresses,new LinearLayout.LayoutParams(-1,dp(52)));loadAddresses();
        button("Atualizar endereços",v->loadAddresses());
        button("Copiar endereço do celular",v->{Object value=addresses.getSelectedItem();if(value!=null&&!value.toString().startsWith("Nenhum"))copy("Endereço do receptor",value.toString());});
        TextView key=text(ReceiverService.token(this),16,Color.WHITE);key.setTransformationMethod(PasswordTransformationMethod.getInstance());key.setContentDescription("Chave de acesso oculta");
        button("Copiar chave de acesso",v->copy("Chave do receptor",ReceiverService.token(this)));
        text("Na extensão, abra “Configurar avisos no Windows” (também aceita este Android). Ative os avisos, cole o endereço e a chave, salve e envie um teste. O nome do botão não impede o uso no celular.",15,0xffbbcad6);
        heading("3. Mantenha a conexão");text("Enquanto ligado, o receptor mantém uma notificação fixa e impede a suspensão da CPU, aumentando o consumo de bateria. O Android e o fabricante ainda podem restringir a rede. Permita uso de bateria sem restrição para este app e para o Tailscale. Não abra a porta na Internet.",15,0xffbbcad6);
        button("Abrir opções de bateria",v->openSettings(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)));
        button("Abrir notificações do aplicativo",v->openSettings(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName())));
        heading("Último aviso recebido");last=text("Nenhum aviso recebido ainda.",15,0xffbbcad6);
        text("Android 8 ou posterior • v1.0.0\nFechar esta tela não desliga o receptor. Use Parar para encerrar. Depois de reiniciar o celular, inicie o receptor novamente. Os lembretes são configurados na extensão.",13,0xffbbcad6);
    }
    private void copy(String label,String value){android.content.ClipboardManager cb=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);ClipData clip=ClipData.newPlainText(label,value);if(label.startsWith("Chave")){PersistableBundle extras=new PersistableBundle();extras.putBoolean("android.content.extra.IS_SENSITIVE",true);clip.getDescription().setExtras(extras);}cb.setPrimaryClip(clip);Toast.makeText(this,label+" copiado.",Toast.LENGTH_SHORT).show();}
    private void openSettings(Intent i){try{startActivity(i);}catch(ActivityNotFoundException e){Toast.makeText(this,"Abra as configurações do Android para este aplicativo.",Toast.LENGTH_LONG).show();}}
    private void authorize(String action){
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){pendingAction=action;requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},7);return;}
        if(!ReceiverService.alertsAllowed(this)){new AlertDialog.Builder(this).setTitle("Permita as notificações").setMessage("Ative as notificações e o canal de verificações para receber os avisos.").setPositiveButton("Configurar",(d,w)->openSettings(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()))).setNegativeButton("Voltar",null).show();return;}
        if(action.equals("test")){ReceiverService.alert(this,"teste");Toast.makeText(this,"Teste enviado. Confira a notificação e o volume.",Toast.LENGTH_LONG).show();}
        else{try{startForegroundService(new Intent(this,ReceiverService.class));status.setText("Iniciando receptor…");}catch(RuntimeException e){status.setText("Não consegui iniciar. Confira as permissões e tente com o aplicativo aberto.");}}
    }
    @Override public void onRequestPermissionsResult(int request,String[] perms,int[] results){super.onRequestPermissionsResult(request,perms,results);if(request==7){String action=pendingAction;pendingAction="";if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)authorize(action);else Toast.makeText(this,"É necessário permitir notificações para receber os avisos.",Toast.LENGTH_LONG).show();}}
    private void loadAddresses(){
        List<String> ips=new ArrayList<>();String selected=addresses.getSelectedItem()==null?"":addresses.getSelectedItem().toString();
        try{Enumeration<NetworkInterface> interfaces=NetworkInterface.getNetworkInterfaces();while(interfaces!=null&&interfaces.hasMoreElements()){NetworkInterface ni=interfaces.nextElement();if(!ni.isUp())continue;Enumeration<InetAddress> addrs=ni.getInetAddresses();while(addrs.hasMoreElements()){InetAddress ip=addrs.nextElement();if(ip instanceof Inet4Address&&!ip.isLoopbackAddress())ips.add("http://"+ip.getHostAddress()+":"+ReceiverService.PORT);}}}catch(SocketException ignored){}
        Collections.sort(ips,(a,b)->Boolean.compare(!a.startsWith("http://100."),!b.startsWith("http://100.")));
        if(ips.isEmpty())ips.add("Nenhum IPv4 disponível. Conecte o Wi-Fi ou Tailscale.");
        ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,ips);addresses.setAdapter(adapter);if(ips.contains(selected))addresses.setSelection(ips.indexOf(selected));
    }
    private void update(){if(ReceiverService.running)status.setText("Ligado — recebendo na porta "+ReceiverService.PORT+".");else status.setText(ReceiverService.lastError.isEmpty()?"Receptor desligado.":ReceiverService.lastError);last.setText(ReceiverService.prefs(this).getString("last","Nenhum aviso recebido ainda."));}
    @Override protected void onSaveInstanceState(Bundle state){state.putString("pendingAction",pendingAction);super.onSaveInstanceState(state);}
    @Override protected void onResume(){super.onResume();timer.post(refresh);}
    @Override protected void onPause(){timer.removeCallbacks(refresh);super.onPause();}
}
