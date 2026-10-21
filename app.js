(function(){
  'use strict';
  const D=window.CameraData,$=id=>document.getElementById(id),cfg=window.SITE_CONFIG||{};
  const frame=$('gasFrame');let data=null,records=[],queryApi=null,endpoint=null,endpointOrigin='',pending=null,requested=false,timeout;
  const channel=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  const allowedGoogle=o=>/^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com|[a-z0-9-]+-script\.googleusercontent\.com)$/.test(o);
  function send(message){if(endpoint)endpoint.postMessage(Object.assign({app:'taipei-camera',channel},message),endpointOrigin);}
  function render(dataIn){
    if(!D.validate(dataIn))return;
    data=dataIn;records=D.rows(data);const s=D.stats(records);
    $('indexValue').textContent=D.percent(s.index);$('scoreFill').style.transform='scaleX('+((s.index||0)/100)+')';
    const selected=$('compareGroup').value;$('compareGroup').replaceChildren(new Option('全部類型','all'),...data.groups.map(g=>new Option(g.label,g.id)));$('compareGroup').value=data.groups.some(g=>g.id===selected)?selected:'all';
    renderBars();
    $('connectionStatus').hidden=true;
    if(queryApi)queryApi.setData(data);
    clearTimeout(timeout);
  }
  function renderBars(){
    const group=$('compareGroup').value,rs=D.filter(records,{group});
    $('districtBars').replaceChildren(...D.districts.map(name=>{const s=D.stats(rs.filter(r=>r.district===name));const button=document.createElement('button');button.className='district-bar';button.setAttribute('aria-label',name+'，'+s.total+'所，裝設覆蓋率'+D.percent(s.index)+'，查看園所');const a=document.createElement('span');a.textContent=name;const track=document.createElement('i');track.setAttribute('aria-hidden','true');const bar=document.createElement('b');bar.style.transform='scaleX('+((s.index||0)/100)+')';track.append(bar);const b=document.createElement('span');b.textContent=s.total?D.percent(s.index):'—';button.append(a,track,b);button.onclick=()=>openQuery({district:name,group,q:''});return button;}));
  }
  function syncFilter(f){
    if(!f||!(f.district==='all'||D.districts.includes(f.district)))return;
    pending=Object.assign({q:'',district:'all',group:'all',indoor:'all',outdoor:'all'},f);
    document.querySelectorAll('#districtButtons button').forEach(b=>{const active=b.textContent===pending.district;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    $('queryHeading').textContent=pending.district==='all'?'園所查詢':pending.district+'園所查詢';
  }
  function openQuery(f){
    pending=Object.assign({q:'',district:'all',group:'all',indoor:'all',outdoor:'all'},f);requested=true;
    $('queryPlaceholder').hidden=true;
    if(window.PREVIEW_DATA){$('localQuery').hidden=false;queryApi.setFilter(pending);}
    else if(cfg.GAS_URL){frame.hidden=false;frame.style.height='950px';send({type:'query',filters:pending});}
    else{$('queryPlaceholder').hidden=false;$('queryPlaceholder').textContent='資料服務尚未連線。';}
    document.querySelectorAll('#districtButtons button').forEach(b=>b.classList.toggle('active',b.textContent===pending.district));
    $('queryHeading').textContent=pending.district==='all'?'園所查詢':pending.district+'園所查詢';
    $('query').scrollIntoView({block:'start'});$('queryHeading').focus({preventScroll:true});
  }
  window.openDistrict=(d)=>openQuery({district:d});
  $('districtButtons').replaceChildren(...D.districts.map(d=>{const b=document.createElement('button');b.textContent=d;b.onclick=()=>openQuery({district:d});return b;}));
  $('heroSearch').onsubmit=e=>{e.preventDefault();openQuery({q:$('schoolSearch').value});};
  $('cityQuery').onclick=()=>openQuery({district:'all'});$('compareGroup').onchange=renderBars;
  $('largeText').onclick=()=>{const v=!document.body.classList.contains('large');document.body.classList.toggle('large',v);$('largeText').setAttribute('aria-pressed',v);$('largeText').textContent=v?'標準文字':'放大文字';send({type:'large',value:v});};
  window.addEventListener('message',e=>{
    const m=e.data;if(!m||m.app!=='taipei-camera'||m.channel!==channel||!allowedGoogle(e.origin))return;
    if(endpoint&&e.source!==endpoint)return;
    if(m.type==='ready'){endpoint=e.source;endpointOrigin=e.origin;send({type:'get'});send({type:'large',value:document.body.classList.contains('large')});frame.hidden=false;frame.style.height='950px';requested=true;send({type:'query',filters:pending||{district:'all'}});return;}
    if(!endpoint)return;
    if(m.type==='data')render(m.data);
    if(m.type==='filters')syncFilter(m.filters);
    if(m.type==='height'&&requested&&Number.isFinite(m.height))frame.style.height=Math.min(14000,Math.max(400,m.height))+'px';
    if(m.type==='error')showError(m.message||'資料讀取失敗，請稍後再試。');
  });
  function showError(msg){$('connectionStatus').hidden=false;$('connectionStatus').textContent=msg;const b=document.createElement('button');b.type='button';b.textContent='重新讀取';b.style.marginLeft='12px';b.onclick=()=>{if(endpoint)send({type:'get'});else connect();};$('connectionStatus').append(b);}
  function connect(){
    endpoint=null;endpointOrigin='';clearTimeout(timeout);
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(cfg.GAS_URL||'')){$('connectionStatus').hidden=false;$('connectionStatus').textContent='資料服務尚未連線。';return;}
    const url=new URL(cfg.GAS_URL);url.searchParams.set('view','bridge');url.searchParams.set('parentOrigin',location.origin);url.searchParams.set('channel',channel);
    frame.src=url.href;$('standaloneLink').href=cfg.GAS_URL;$('standaloneLink').hidden=false;
    timeout=setTimeout(()=>showError('連線逾時，請重新讀取。'),25000);
  }
  if(window.PREVIEW_DATA){
    document.title='互動預覽｜'+document.title;$('localQuery').hidden=false;
    queryApi=window.mountQuery($('localQuery'),syncFilter);render(window.PREVIEW_DATA);
  }else connect();
  const hash=new URLSearchParams(location.hash.slice(1));if(hash.get('district')&&D.districts.includes(hash.get('district')))openQuery({district:hash.get('district')});
  setInterval(()=>{if(endpoint&&!document.hidden)send({type:'get'});},Math.max(60000,Number(cfg.POLL_MS)||300000));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&endpoint)send({type:'get'});});
  let scrollPending=false;const top=$('backTop');
  function scrollState(){scrollPending=false;const max=document.documentElement.scrollHeight-innerHeight;const progress=max>0?Math.min(1,Math.max(0,scrollY/max)):0;top.hidden=scrollY<280;$('topProgress').style.strokeDashoffset=String(100-progress*100);}
  function queueScroll(){if(!scrollPending){scrollPending=true;requestAnimationFrame(scrollState);}}
  addEventListener('scroll',queueScroll,{passive:true});addEventListener('resize',queueScroll);scrollState();
  top.onclick=()=>{window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});$('main').focus({preventScroll:true});};
  window.cameraApp={openQuery,render};
})();
