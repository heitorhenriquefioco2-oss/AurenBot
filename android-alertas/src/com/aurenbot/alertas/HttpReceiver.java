package com.aurenbot.alertas;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

/** Small bounded HTTP endpoint; no administration or key endpoints are exposed. */
public final class HttpReceiver implements Closeable {
    public interface Handler { Reply handle(String body); }
    public static final class Reply {
        public final int status; public final String body;
        public Reply(int status, String body) { this.status=status; this.body=body; }
    }
    private final byte[] token;
    private final Handler handler;
    private final Set<Socket> clients=ConcurrentHashMap.newKeySet();
    private final ExecutorService workers=new ThreadPoolExecutor(2,4,30,TimeUnit.SECONDS,new ArrayBlockingQueue<Runnable>(16));
    private ServerSocket listener;
    private volatile boolean closed;
    public HttpReceiver(String token, Handler handler) { this.token=token.getBytes(StandardCharsets.UTF_8); this.handler=handler; }
    public synchronized void start(int port) throws IOException {
        if (listener!=null) throw new IOException("Receptor já iniciado");
        listener=new ServerSocket(); listener.setReuseAddress(true);
        listener.bind(new InetSocketAddress("0.0.0.0",port));
        Thread accept=new Thread(()->{
            while (!closed) {
                try {
                    Socket socket=listener.accept(); clients.add(socket);
                    try { workers.execute(()->serve(socket)); }
                    catch (RejectedExecutionException e) { clients.remove(socket); socket.close(); }
                } catch (IOException e) { if (!closed) close(); }
            }
        },"auren-http"); accept.setDaemon(true); accept.start();
    }
    public int port() { return listener.getLocalPort(); }
    private static String line(InputStream in,int[] remaining) throws IOException {
        ByteArrayOutputStream out=new ByteArrayOutputStream(); int b;
        while ((b=in.read())!=-1) {
            if (--remaining[0]<0) throw new IOException("Cabeçalho muito grande");
            if (b==10) return new String(out.toByteArray(),StandardCharsets.US_ASCII).replaceAll("\\r$","");
            if (b!=13 && (b<32 || b>126)) throw new IOException("Cabeçalho inválido");
            out.write(b);
        }
        throw new EOFException();
    }
    private void serve(Socket socket) {
        String origin="";
        try (Socket client=socket) {
            client.setSoTimeout(5000); InputStream in=client.getInputStream(); int[] budget={8192};
            String[] request=line(in,budget).split(" ");
            if (request.length!=3 || !(request[2].equals("HTTP/1.1")||request[2].equals("HTTP/1.0"))) { respond(client,new Reply(400,"{\"ok\":false}"),origin); return; }
            Map<String,String> headers=new HashMap<>(); String entry;
            while (!(entry=line(in,budget)).isEmpty()) {
                int i=entry.indexOf(':'); if (i<1) throw new IOException("Cabeçalho inválido");
                String name=entry.substring(0,i).toLowerCase(Locale.ROOT);
                if (!name.matches("[a-z0-9-]+") || headers.put(name,entry.substring(i+1).trim())!=null) throw new IOException("Cabeçalho repetido");
            }
            origin=headers.getOrDefault("origin","");
            if (!origin.isEmpty() && !origin.matches("chrome-extension://[a-p]{32}")) { respond(client,new Reply(403,"{\"ok\":false}"),""); return; }
            if (request[1].equals("/api/health") && request[0].equals("GET")) { respond(client,new Reply(200,"{\"ok\":true,\"app\":\"AurenBot Alertas Android\"}"),origin); return; }
            if (!request[1].equals("/api/notify")) { respond(client,new Reply(404,"{\"ok\":false}"),origin); return; }
            if (request[0].equals("OPTIONS")) { respond(client,new Reply(204,""),origin); return; }
            if (!request[0].equals("POST")) { respond(client,new Reply(405,"{\"ok\":false}"),origin); return; }
            String auth=headers.getOrDefault("authorization","");
            if (!auth.startsWith("Bearer ") || !MessageDigest.isEqual(token,auth.substring(7).getBytes(StandardCharsets.UTF_8))) { respond(client,new Reply(401,"{\"ok\":false}"),origin); return; }
            if (headers.containsKey("transfer-encoding") || !headers.getOrDefault("content-type","").toLowerCase(Locale.ROOT).matches("application/json(?:;.*)?")) { respond(client,new Reply(400,"{\"ok\":false}"),origin); return; }
            int length;
            try { length=Integer.parseInt(headers.getOrDefault("content-length","-1")); } catch (NumberFormatException e) { length=-1; }
            if (length<1 || length>4096) { respond(client,new Reply(400,"{\"ok\":false}"),origin); return; }
            byte[] body=new byte[length]; int read=0,n;
            while (read<length && (n=in.read(body,read,length-read))!=-1) read+=n;
            if (read!=length) throw new EOFException();
            if (!closed) respond(client,handler.handle(new String(body,StandardCharsets.UTF_8)),origin);
        } catch (IOException | RuntimeException ignored) {
            // Never log headers, credentials, or bodies.
        } finally { clients.remove(socket); }
    }
    private static void respond(Socket s,Reply r,String origin) throws IOException {
        byte[] body=r.body.getBytes(StandardCharsets.UTF_8);
        String cors=origin.isEmpty()?"":"Access-Control-Allow-Origin: "+origin+"\r\nVary: Origin\r\n";
        String header="HTTP/1.1 "+r.status+" Response\r\nContent-Type: application/json; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n"+cors+
            "Access-Control-Allow-Methods: POST\r\nAccess-Control-Allow-Headers: Authorization, Content-Type\r\nAccess-Control-Allow-Private-Network: true\r\n"+(r.status==429?"Retry-After: 10\r\n":"")+"Content-Length: "+body.length+"\r\n\r\n";
        s.getOutputStream().write(header.getBytes(StandardCharsets.US_ASCII));s.getOutputStream().write(body);s.getOutputStream().flush();
    }
    @Override public void close() {
        closed=true;
        try { if (listener!=null) listener.close(); } catch (IOException ignored) {}
        for (Socket s:clients) try { s.close(); } catch (IOException ignored) {}
        clients.clear(); workers.shutdownNow();
    }
}
