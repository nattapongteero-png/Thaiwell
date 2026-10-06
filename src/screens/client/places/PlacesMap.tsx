import React from 'react';
import { Platform, UIManager, View } from 'react-native';
import { Placeholder, useTheme } from '../../../design-system';
import { radius } from '../../../design-system/tokens';

/**
 * แผนที่ 3 มิติ (แนวเดียวกับ flood.pop.in.th/3d) — ฟรีทั้งหมด
 * - MapLibre GL (โอเพนซอร์ส) + ภาพแผนที่ OpenFreeMap (ไม่ต้องใช้คีย์ · ข้อมูล © OpenStreetMap)
 * - ตึกยกขึ้นเป็น 3 มิติ · แท่งสีที่คลินิก = จำนวนคิวว่างวันนี้ (สูง = ว่างมาก) · หมุด + ชื่อ
 * - แตะหมุด → แจ้งกลับ (onPick) · ตำแหน่งคุณ = จุดสีน้ำเงิน
 * เว็บ = iframe · iOS/Android = WebView (ต้อง build แอปใหม่หลังติดตั้ง react-native-webview)
 */
export interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: 'clinic' | 'hospital';
  slots: number;
}

export function placesMapHtml(allPlaces: MapPlace[], me: { lat: number; lng: number } | null | undefined, selected?: string) {
  // สถานที่ที่ยังไม่ได้ปักพิกัดไม่แสดงบนแผนที่ · ไม่รู้ตำแหน่งผู้ใช้ → ไม่มีหมุดผู้ใช้ จัดกลางที่สถานที่แรก
  const places = allPlaces.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<style>
html,body,#m{margin:0;height:100%;background:#eef1ee;font-family:-apple-system,'IBM Plex Sans Thai',sans-serif}
.pin{display:flex;flex-direction:column;align-items:center;cursor:pointer;transform:translateY(-6px)}
.tag{background:rgba(255,255,255,.94);border-radius:12px;padding:4px 8px;font-size:11px;font-weight:600;color:#1f2a24;box-shadow:0 4px 12px rgba(15,23,42,.14);white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis}
.pin.sel .tag{max-width:180px}.pin .full{display:none}.pin.sel .full{display:inline}.pin.sel .short{display:none}
.tag small{display:block;font-weight:500;color:#6b7280;font-size:10px}
.pin.sel .tag{background:#15803d;color:#fff}.pin.sel .tag small{color:#d1fae5}
.dot{width:12px;height:12px;border-radius:50%;border:2px solid #fff;margin-top:4px;box-shadow:0 2px 6px rgba(0,0,0,.25)}
.me{width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.2)}
.maplibregl-ctrl-attrib{font-size:9px}
</style></head><body><div id="m"></div><script>
const P=${JSON.stringify(places)},ME=${JSON.stringify(me ?? null)},SEL=${JSON.stringify(selected ?? null)};
const send=(o)=>{const s=JSON.stringify(o);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else parent.postMessage(s,'*');};
const map=new maplibregl.Map({container:'m',style:'https://tiles.openfreemap.org/styles/liberty',center:ME?[ME.lng,ME.lat]:P[0]?[P[0].lng,P[0].lat]:[100.5018,13.7563],zoom:14.6,pitch:58,bearing:-18,attributionControl:{compact:true}});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true,showZoom:false}),'bottom-right');
// แท่งคิวว่าง: วงกลมเล็ก ๆ ยกขึ้นตามจำนวนคิว (โรงพยาบาล = แท่งแดงเตี้ย)
const circle=(lng,lat,r)=>{const c=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI*2;c.push([lng+Math.cos(a)*r/Math.cos(lat*Math.PI/180),lat+Math.sin(a)*r]);}return c;};
map.on('load',()=>{
  // ตึก 3 มิติ (สีกลางอ่อน ให้แท่งข้อมูลเด่น)
  for(const l of map.getStyle().layers){if(l.type==='fill-extrusion'){map.setPaintProperty(l.id,'fill-extrusion-color','#dfe4df');map.setPaintProperty(l.id,'fill-extrusion-opacity',.85);}}
  map.addSource('bars',{type:'geojson',data:{type:'FeatureCollection',features:P.map(p=>({type:'Feature',properties:{h:p.kind==='hospital'?120:80+p.slots*260,c:p.kind==='hospital'?'#dc2626':p.slots?'#15803d':'#9ca3af'},geometry:{type:'Polygon',coordinates:[circle(p.lng,p.lat,0.00045)]}}))}});
  map.addLayer({id:'bars',type:'fill-extrusion',source:'bars',paint:{'fill-extrusion-color':['get','c'],'fill-extrusion-height':['get','h'],'fill-extrusion-opacity':.88}});
  for(const p of P){const el=document.createElement('div');el.className='pin'+(p.id===SEL?' sel':'');
    const short=p.name.replace(/^(คลินิกแพทย์แผนไทย|ศูนย์แพทย์แผนไทย|โรงพยาบาลชุมชน|ศูนย์บริการสาธารณสุข|บ้านนวดไทย)\s*/,'')||p.name;
    el.innerHTML='<div class="tag"><span class="short">'+short+'</span><span class="full">'+p.name+'</span><small>'+(p.kind==='hospital'?'โรงพยาบาล':p.slots?('ว่าง '+p.slots+' คิววันนี้'):'คิวเต็ม')+'</small></div><div class="dot" style="background:'+(p.kind==='hospital'?'#dc2626':'#15803d')+'"></div>';
    el.onclick=(e)=>{e.stopPropagation();document.querySelectorAll('.pin').forEach(x=>x.classList.remove('sel'));el.classList.add('sel');map.easeTo({center:[p.lng,p.lat],zoom:15,duration:700});send({type:'pick',id:p.id});};
    new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([p.lng,p.lat]).addTo(map);}
  if(ME){const me=document.createElement('div');me.className='me';new maplibregl.Marker({element:me}).setLngLat([ME.lng,ME.lat]).addTo(map);}
  // หมุนกล้องช้า ๆ ครั้งแรก ให้เห็นว่าเป็น 3 มิติ
  // ย่านรอบตัวคุณ (เห็นตึก 3 มิติ) แล้วค่อย ๆ หมุนให้เห็นมิติ · ที่ไกลออกไปลาก/ซูมดูได้
  map.jumpTo({center:[ME.lng+0.004,ME.lat+0.001],zoom:14.3});
  map.easeTo({bearing:10,duration:2600});
  send({type:'ready'});
});
</script></body></html>`;
}

/** เว็บ: iframe จาก blob URL (srcDoc มี origin "null" → MapLibre โหลดแผนที่ไม่ขึ้น) */
function WebMapFrame({ html, style }: { html: string; style: object }) {
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [html]);
  return <View style={style}>{src ? React.createElement('iframe', { src, title: 'แผนที่สถานที่', style: { border: 0, width: '100%', height: '100%' } }) : null}</View>;
}

/** มี WebView แบบ native ในแอปที่ build อยู่ไหม (ติดตั้งแพ็กเกจแล้วแต่ยังไม่ build ใหม่ = ไม่มี) */
// New Architecture (Fabric) ไม่ลงทะเบียน view ใน UIManager → ดูจาก native module ของ webview แทน
const hasNativeWebView =
  Platform.OS !== 'web' &&
  (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { TurboModuleRegistry } = require('react-native');
      return !!(TurboModuleRegistry.get('RNCWebViewModule') || UIManager.hasViewManagerConfig?.('RNCWebView'));
    } catch {
      return false;
    }
  })();

export function PlacesMap({ places, me, selected, onPick, height = 260 }: { places: MapPlace[]; me?: { lat: number; lng: number } | null; selected?: string; onPick?: (id: string) => void; height?: number }) {
  const { colors } = useTheme();
  // ไม่สร้างแผนที่ใหม่เมื่อเลือกสถานที่ (หมุดเปลี่ยนสีในแผนที่เอง)
  const html = React.useMemo(() => placesMapHtml(places, me, selected), [places, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const onPickRef = React.useRef(onPick);
  onPickRef.current = onPick;
  const frame = { height, borderRadius: radius.lg, overflow: 'hidden' as const, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: '#eef1ee' };

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const h = (e: MessageEvent) => {
      try {
        const m = JSON.parse(String(e.data));
        if (m.type === 'pick') onPickRef.current?.(m.id);
      } catch {
        /* ข้อความอื่น */
      }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  if (Platform.OS === 'web') return <WebMapFrame html={html} style={frame} />;
  if (!hasNativeWebView) return <Placeholder height={height} label="แผนที่ (build แอปใหม่เพื่อเปิดใช้)" icon="map" />;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WebView } = require('react-native-webview') as typeof import('react-native-webview');
  return (
    <View style={frame}>
      <WebView
        originWhitelist={['*']}
        // baseUrl = มี origin จริง (MapLibre ใช้ worker/fetch · origin "null" โหลดไม่ขึ้น)
        source={{ html, baseUrl: 'https://localhost/' }}
        style={{ backgroundColor: 'transparent' }}
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.type === 'pick') onPickRef.current?.(m.id);
          } catch {
            /* ignore */
          }
        }}
      />
    </View>
  );
}
