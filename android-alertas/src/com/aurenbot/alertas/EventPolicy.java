package com.aurenbot.alertas;

import org.json.*;
import java.util.*;

public final class EventPolicy {
    public static final class Event {
        public final String id,type;
        Event(String id,String type) { this.id=id;this.type=type; }
    }
    private final Map<String,Long> seen=new HashMap<>(); private Long last;
    public static Event parse(String body) throws JSONException {
        JSONTokener reader=new JSONTokener(body); Object value=reader.nextValue();
        if (!(value instanceof JSONObject)||reader.nextClean()!=0) throw new JSONException("JSON inválido");
        JSONObject object=(JSONObject)value;
        if (object.length()!=2 || !(object.opt("id") instanceof String) || !(object.opt("tipo") instanceof String)) throw new JSONException("Campos inválidos");
        String id=object.getString("id"),type=object.getString("tipo");
        if (!id.matches("[a-zA-Z0-9-]{1,100}") || !(type.equals("cloudflare")||type.equals("sombra"))) throw new JSONException("Aviso inválido");
        return new Event(id,type);
    }
    public synchronized void rollback(String id) { Long date=seen.remove(id);if(date!=null&&date.equals(last))last=null; }
    /** 200 = new, 208 = duplicate, 429 = rate limited. Caller serializes with notification. */
    public synchronized int accept(String id,long now) {
        Iterator<Long> dates=seen.values().iterator();while(dates.hasNext()) if(now-dates.next()>86400000L)dates.remove();
        if(seen.containsKey(id))return 208;
        if((last!=null && now-last<10000L)||seen.size()>=4096)return 429;
        seen.put(id,now);last=now;return 200;
    }
}
