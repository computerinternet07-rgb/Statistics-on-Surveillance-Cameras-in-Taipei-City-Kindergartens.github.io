

(function(root){
  'use strict';
  const districts=['松山區','信義區','大安區','中山區','中正區','大同區','萬華區','文山區','南港區','內湖區','士林區','北投區'];
  const labels={yes:'已裝設',no:'未裝設',unknown:'待確認',full:'全數裝設',partial:'部分裝設',none:'尚未裝設'};
  const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/台/g,'臺').replace(/[\s()（）·・]/g,'');
  const columnKeys=['type','district','name','outdoor','indoor','group'];
  function rows(data){return data.columns.name.map((_,i)=>Object.fromEntries(columnKeys.map(k=>[k,data.columns[k][i]])));}
  function stats(rs){const s={total:rs.length,known:0,unknown:0,score:0,bins:[0,0,0,0,0,0],fullAndOutdoor:0,indoorFull:0,outdoorYes:0};rs.forEach(r=>{if(r.indoor==='unknown'||r.outdoor==='unknown')s.unknown++;else{const n={full:4,partial:2,none:0}[r.indoor]+(r.outdoor==='yes'?1:0);s.score+=n;s.known++;s.bins[n]++;}if(r.outdoor==='yes')s.outdoorYes++;if(r.indoor==='full')s.indoorFull++;if(r.outdoor==='yes'&&r.indoor==='full')s.fullAndOutdoor++;});s.index=s.total&&!s.unknown?s.score/(5*s.total)*100:null;s.originalIndex=s.index===null?null:s.index/3;return s;}
  function match(text,q){const a=normalize(text),b=normalize(q);if(!b)return true;if(a.includes(b))return true;let p=0;for(const c of a){if(c===b[p])p++;if(p===b.length)return true;}return false;}
  function filter(rs,f){return rs.filter(r=>(!f.district||f.district==='all'||r.district===f.district)&&(!f.group||f.group==='all'||r.group===f.group)&&(!f.indoor||f.indoor==='all'||r.indoor===f.indoor)&&(!f.outdoor||f.outdoor==='all'||r.outdoor===f.outdoor)&&match(r.name+' '+r.district+' '+r.type,f.q));}
  function validate(d){
    if(!d||typeof d!=='object'||!d.columns||!Array.isArray(d.columns.name)||!Array.isArray(d.groups))return false;
    const c=d.columns,n=c.name.length;
    if(n>1000||d.groups.length>4||!columnKeys.every(k=>Array.isArray(c[k])&&c[k].length===n&&c[k].every(x=>typeof x==='string')))return false;
    const ids=new Set();
    for(const g of d.groups){
      if(!g||!['public','nonprofit','quasi','private'].includes(g.id)||typeof g.label!=='string'||ids.has(g.id))return false;
      ids.add(g.id);
    }
    return c.district.every(x=>districts.includes(x))&&c.group.every(x=>ids.has(x))&&
      c.outdoor.every(x=>['yes','no','unknown'].includes(x))&&c.indoor.every(x=>['full','partial','none','unknown'].includes(x));
  }
  function percent(n){return n==null?'—':n.toFixed(1)+'%';}
  root.CameraData={districts,labels,normalize,rows,stats,filter,validate,percent};
  if(typeof module!=='undefined')module.exports=root.CameraData;
})(typeof window!=='undefined'?window:globalThis);


