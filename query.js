(function(root){
  'use strict';
  const D=root.CameraData;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function visual(kind,status){
    const full=status==='full'||status==='yes',partial=status==='partial',unknown=status==='unknown';let drawing='';
    if(kind==='indoor'){
      drawing='<path class="paint" d="M17 32 47 13 77 32v37H17Z"/><path class="structure" d="m13 34 34-23 34 23M20 30v39h54V30M43 69V50h12v19"/>';
      drawing+='<rect class="'+(full?'filled':'inactive')+'" x="29" y="35" width="9" height="10" rx="1"/><rect class="'+(full?'filled':'inactive')+'" x="58" y="35" width="9" height="10" rx="1"/>';
      if(partial)drawing+='<path class="structure" d="m29 44 9-9m20 9 9-9"/>';
    }else{
      drawing='<path class="paint" d="M14 69V49h64v20Z"/><path class="structure" d="M14 69V48h64v21M25 48v21m12-21v21m12-21v21m12-21v21M67 46V19h-9"/><path class="structure" d="m26 14 29 4-3 13-29-4Z"/><path class="structure" d="m28 28-6 7h16l4-5"/>';
      if(full)drawing+='<path class="structure" d="m21 23-7 5m8-13-8-3m4 8H8"/>';
    }
    drawing+='<circle cx="80" cy="62" r="12" fill="white"/>';
    if(full)drawing+='<path class="mark" d="m73 62 5 5 9-11"/>';
    else if(partial)drawing+='<circle class="structure" cx="80" cy="62" r="8"/><path class="filled" d="M80 54a8 8 0 0 1 0 16Z"/>';
    else if(unknown)drawing+='<path class="mark" d="M76 57c0-6 10-5 8 1-1 3-4 2-4 6m0 5v.1"/>';
    else drawing+='<circle class="structure" cx="80" cy="62" r="8"/><path class="mark" d="m75 67 10-10"/>';
    return '<figure class="installation" data-status="'+status+'"><svg viewBox="0 0 100 80" aria-hidden="true">'+drawing+'</svg><figcaption><span>'+(kind==='indoor'?'室內':'室外')+'</span><strong>'+D.labels[status]+'</strong></figcaption></figure>';
  }
  root.mountQuery=function(host,onChange){
    const state={data:null,rs:[],f:{q:'',group:'all',district:'all',indoor:'all',outdoor:'all'},page:1};
    host.innerHTML='<div class="query-app"><form id="qForm"><div class="query-toolbar"><div><label for="qName">園所名稱</label><input id="qName" type="search" maxlength="100"></div><div><label for="qDistrict">行政區</label><select id="qDistrict"><option value="all">全臺北市</option>'+D.districts.map(d=>'<option>'+d+'</option>').join('')+'</select></div><div><label for="qGroup">園所類型</label><select id="qGroup"><option value="all">全部類型</option></select></div></div><div class="query-extra"><div><label for="qIndoor">室內裝設</label><select id="qIndoor"><option value="all">全部狀態</option><option value="full">全數裝設</option><option value="partial">部分裝設</option><option value="none">尚未裝設</option><option value="unknown">待確認</option></select></div><div><label for="qOutdoor">室外裝設</label><select id="qOutdoor"><option value="all">全部狀態</option><option value="yes">已裝設</option><option value="no">未裝設</option><option value="unknown">待確認</option></select></div><button type="submit" class="primary">查詢</button><button type="button" id="qReset">清除篩選</button></div></form><div class="query-summary" id="qSummary" role="status" aria-live="polite"></div><div class="query-results" id="qResults"></div><nav class="pagination" aria-label="查詢結果分頁"><button type="button" id="qPrev">上一頁</button><p id="qPage"></p><button type="button" id="qNext">下一頁</button></nav></div>';
    const $=id=>host.querySelector('#'+id);
    const controls={q:'qName',district:'qDistrict',group:'qGroup',indoor:'qIndoor',outdoor:'qOutdoor'};
    function render(){
      if(!state.data)return;
      const result=D.filter(state.rs,state.f),pages=Math.max(1,Math.ceil(result.length/30));
      state.page=Math.min(state.page,pages);
      // District statistics are independent of the name and status filters.
      const scope=D.filter(state.rs,{district:state.f.district,group:state.f.group}),s=D.stats(scope);
      $('qSummary').innerHTML='<p>查詢結果 <strong>'+result.length+'</strong> 所</p><p>'+escape(state.f.district==='all'?'全市':state.f.district)+'裝設覆蓋率 <strong>'+D.percent(s.index)+'</strong></p>';
      $('qResults').innerHTML=result.length?result.slice((state.page-1)*30,state.page*30).map(r=>'<article class="school"><p class="school-type">'+escape(r.district)+' · '+escape(r.type)+'</p><h3>'+escape(r.name)+'</h3><div class="school-visuals">'+visual('indoor',r.indoor)+visual('outdoor',r.outdoor)+'</div></article>').join(''):'<div class="empty"><h3>沒有符合的園所</h3></div>';
      $('qPage').textContent='第 '+state.page+' / '+pages+' 頁';$('qPrev').disabled=state.page<=1;$('qNext').disabled=state.page>=pages;
      if(onChange)onChange({...state.f},state.page);
    }
    function read(){Object.entries(controls).forEach(([k,id])=>state.f[k]=$(id).value);state.page=1;render();}
    $('qForm').addEventListener('submit',e=>{e.preventDefault();read();});
    let timer;Object.values(controls).forEach(id=>$(id).addEventListener(id==='qName'?'input':'change',()=>{clearTimeout(timer);timer=setTimeout(read,id==='qName'?100:0);}));
    $('qReset').onclick=()=>{Object.entries(controls).forEach(([k,id])=>$(id).value=k==='q'?'':'all');read();};
    $('qPrev').onclick=()=>{state.page--;render();$('qSummary').scrollIntoView({block:'start'});};$('qNext').onclick=()=>{state.page++;render();$('qSummary').scrollIntoView({block:'start'});};
    return {
      setData(data){if(!D.validate(data))throw new Error('資料格式不符');state.data=data;state.rs=D.rows(data);$('qGroup').innerHTML='<option value="all">全部類型</option>'+data.groups.map(g=>'<option value="'+escape(g.id)+'">'+escape(g.label)+'</option>').join('');$('qGroup').value=data.groups.some(g=>g.id===state.f.group)?state.f.group:'all';state.f.group=$('qGroup').value;render();},
      setFilter(f){Object.entries(controls).forEach(([k,id])=>{if(f[k]!==undefined){$(id).value=f[k];state.f[k]=$(id).value||(k==='q'?'':'all');}});state.page=1;render();},
      setLarge(v){document.body.classList.toggle('large',!!v);},
      focus(){ $('qName').focus({preventScroll:true}); }
    };
  };
})(window);
