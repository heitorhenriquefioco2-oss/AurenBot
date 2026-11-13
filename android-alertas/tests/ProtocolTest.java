package com.aurenbot.alertas;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class ProtocolTest {
 static final String KEY=String.join("",Collections.nCopies(64,"a"));
 static int tests;
 static void check(boolean value,String label) { if(!value)throw new AssertionError(label);tests++;System.out.println("PASS: "+label); }
 static String request(int port,String method,String path,String body,String auth,String origin) throws Exception {
  try(Socket s=new Socket("127.0.0.1",port)) {
   s.setSoTimeout(3000);byte[] data=body.getBytes(StandardCharsets.UTF_8);
   String headers=method+" "+path+" HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: "+data.length+"\r\n"+(auth.isEmpty()?"":"Authorization: "+auth+"\r\n")+(origin.isEmpty()?"":"Origin: "+origin+"\r\n")+"\r\n";
   s.getOutputStream().write(headers.getBytes(StandardCharsets.UTF_8));s.getOutputStream().write(data);s.getOutputStream().flush();
   ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[2048];int n;while((n=s.getInputStream().read(b))!=-1)out.write(b,0,n);return new String(out.toByteArray(),StandardCharsets.UTF_8);
  }
 }
 static boolean code(String s,int c){return s.startsWith("HTTP/1.1 "+c+" ");}
 public static void main(String[] args) throws Exception {
  final AtomicInteger calls=new AtomicInteger();final AtomicLong now=new AtomicLong(0);EventPolicy ledger=new EventPolicy();
  HttpReceiver.Handler handler=body->{try{EventPolicy.Event e=EventPolicy.parse(body);int status=ledger.accept(e.id,now.get());if(status==200)calls.incrementAndGet();return new HttpReceiver.Reply(status==208?200:status,status==208?"{\"ok\":true,\"duplicado\":true}":status==200?"{\"ok\":true}":"{\"ok\":false}");}catch(Exception e){return new HttpReceiver.Reply(400,"{\"ok\":false}");}};
  if(args.length>0&&args[0].equals("serve")){HttpReceiver server=new HttpReceiver(KEY,handler);server.start(18766);System.out.println("READY");new CountDownLatch(1).await();return;}
  for(String body:new String[]{"{}","{\"id\":\"a\",\"tipo\":\"other\"}","{\"id\":42,\"tipo\":\"sombra\"}","{\"id\":\"a\",\"tipo\":\"sombra\",\"image\":\"x\"}","{\"id\":\"a\",\"tipo\":\"sombra\"} {}","{\"id\":\"\",\"tipo\":\"sombra\"}"}) {
   boolean refused=false;try{EventPolicy.parse(body);}catch(Exception e){refused=true;}check(refused,"rejeita esquema inválido "+tests);
  }
  check(EventPolicy.parse("{\"id\":\"one\",\"tipo\":\"sombra\"}").type.equals("sombra"),"interpreta desafio de sombra");
  try(HttpReceiver server=new HttpReceiver(KEY,handler)) {
   server.start(0);int p=server.port();String body="{\"id\":\"one\",\"tipo\":\"cloudflare\"}";
   check(code(request(p,"GET","/api/health","","",""),200),"saúde acessível pela rede");
   check(code(request(p,"GET","/api/state","","",""),404),"não expõe chave ou administração HTTP");
   check(code(request(p,"POST","/api/notify",body,"",""),401),"exige autenticação");
   check(code(request(p,"POST","/api/notify",body,"Bearer wrong",""),401),"recusa chave incorreta");
   check(code(request(p,"GET","/api/notify","","Bearer "+KEY,""),405),"não permite GET nos avisos");
   check(code(request(p,"POST","/api/notify",body,"Bearer "+KEY,"https://evil.example"),403),"recusa origem de site");
   String origin="chrome-extension://"+String.join("",Collections.nCopies(32,"a"));
   String pre=request(p,"OPTIONS","/api/notify","","",origin);
   check(code(pre,204)&&pre.contains("Access-Control-Allow-Origin: "+origin)&&pre.contains("Access-Control-Allow-Private-Network: true"),"preflight de extensão e rede privada");
   check(code(request(p,"POST","/api/notify",body,"Bearer "+KEY,origin),200)&&calls.get()==1,"aviso autenticado entrega um evento");
   String duplicate=request(p,"POST","/api/notify",body,"Bearer "+KEY,origin);
   check(code(duplicate,200)&&duplicate.contains("duplicado")&&calls.get()==1,"repetição do mesmo id não duplica aviso");
   String next="{\"id\":\"two\",\"tipo\":\"sombra\"}";
   check(code(request(p,"POST","/api/notify",next,"Bearer "+KEY,""),429),"limita novos avisos em dez segundos");
   now.set(10000);check(code(request(p,"POST","/api/notify",next,"Bearer "+KEY,""),200)&&calls.get()==2,"novo aviso após intervalo é aceito");
   check(code(request(p,"POST","/api/notify",String.join("",Collections.nCopies(5000,"x")),"Bearer "+KEY,""),400),"recusa corpo maior que 4096 bytes");
   check(code(request(p,"POST","/api/notify","{}","Bearer "+KEY,""),400),"valida JSON recebido por HTTP");
  }
  EventPolicy concurrent=new EventPolicy();AtomicInteger accepted=new AtomicInteger();ExecutorService pool=Executors.newFixedThreadPool(8);List<Future<?>> jobs=new ArrayList<>();
  for(int i=0;i<40;i++)jobs.add(pool.submit(()->{if(concurrent.accept("same",0)==200)accepted.incrementAndGet();}));for(Future<?> f:jobs)f.get();pool.shutdown();check(accepted.get()==1,"deduplicação concorrente entrega uma vez");
  EventPolicy rollback=new EventPolicy();rollback.accept("retry",0);rollback.rollback("retry");check(rollback.accept("retry",1)==200,"falha de notificação permite nova tentativa");
  EventPolicy expired=new EventPolicy();expired.accept("old",0);check(expired.accept("old",86400001L)==200,"identificador pode expirar depois de 24h");
  System.out.println("TOTAL "+tests);
 }
}
