

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
    if(full)drawing+='<path class="mark" pathLength="1" d="m73 62 5 5 9-11"/>';
    else if(partial)drawing+='<circle class="structure" cx="80" cy="62" r="8"/><path class="filled" d="M80 54a8 8 0 0 1 0 16Z"/>';
    else if(unknown)drawing+='<path class="mark" pathLength="1" d="M76 57c0-6 10-5 8 1-1 3-4 2-4 6m0 5v.1"/>';
    else drawing+='<circle class="structure" cx="80" cy="62" r="8"/><path class="mark" pathLength="1" d="m75 67 10-10"/>';
    return '<figure class="installation" data-status="'+status+'"><svg viewBox="0 0 100 80" aria-hidden="true">'+drawing+'</svg><figcaption><span>'+(kind==='indoor'?'室內':'室外')+'</span><strong>'+D.labels[status]+'</strong></figcaption></figure>';
  }
  root.mountQuery=function(host,onChange,onNavigate){
    const PAGE_SIZE=10;
    const defaults=()=>({q:'',group:'all',district:'all',indoor:'all',outdoor:'all'});
    const state={data:null,rs:[],f:defaults(),page:1};
    const searchIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
    const closeIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>';
    host.innerHTML=`<div class="query-app">
      <form id="qForm" class="query-form" role="search" aria-label="查詢幼兒園">
        <div class="query-label-row"><label class="name-label" for="qName">幼兒園名稱</label><button type="button" id="qReset" class="query-reset">清除條件</button></div>
        <div class="query-search-row"><div class="query-input-wrap">${searchIcon}<input id="qName" type="search" maxlength="100" placeholder="輸入完整名稱或部分名稱" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-controls="qResults"><button type="button" id="qClear" aria-label="清除園所名稱" hidden>${closeIcon}</button></div><button type="submit" class="primary" id="qSubmit">查詢園所</button></div>
        <div class="query-primary-fields">
          <div><label for="qDistrict">行政區</label><select id="qDistrict"><option value="all">全臺北市</option>${D.districts.map(d=>'<option>'+d+'</option>').join('')}</select></div>
          <div><label for="qGroup">園所類型</label><select id="qGroup"><option value="all">全部類型</option></select></div>
        </div>
        <details class="query-options" id="qOptions"><summary><span>裝設條件<span id="filterCount"></span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>
          <div class="query-fields">
            <div><label for="qIndoor">室內裝設</label><select id="qIndoor"><option value="all">全部狀態</option><option value="full">全數裝設</option><option value="partial">部分裝設</option><option value="none">尚未裝設</option><option value="unknown">待確認</option></select></div>
            <div><label for="qOutdoor">室外裝設</label><select id="qOutdoor"><option value="all">全部狀態</option><option value="yes">已裝設</option><option value="no">未裝設</option><option value="unknown">待確認</option></select></div>
          </div>
        </details>
        <div class="query-chips" id="qChips" aria-label="目前查詢條件" hidden></div>
      </form>
      <div class="query-result-heading"><h2 id="qSummary" tabindex="-1">查詢結果</h2><p id="qScope"></p></div>
      <p id="qAnnounce" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="query-results" id="qResults" aria-busy="true"></div>
      <nav class="pagination" aria-label="查詢結果分頁" hidden id="qPagination"><button type="button" id="qPrev">上一頁</button><p id="qPage"></p><button type="button" id="qNext">下一頁</button></nav>
    </div>`;
    const $=id=>host.querySelector('#'+id);
    const controls={q:'qName',district:'qDistrict',group:'qGroup',indoor:'qIndoor',outdoor:'qOutdoor'};
    const labels={q:'名稱',district:'行政區',group:'類型',indoor:'室內',outdoor:'室外'};
    let inputTimer,feedbackTimer,composing=false,cancelResultNavigation=()=>{};
    host.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
    // Reading feedback only: cards stay articles and never intercept page scrolling.
    let pressedCard=null,pressedPointer=null,pressTimer,pressX=0,pressY=0;
    function clearCardPress(){
      clearTimeout(pressTimer);pressedCard?.classList.remove('is-pressed');pressedCard=null;pressedPointer=null;
    }
    $('qResults').addEventListener('pointerdown',e=>{
      if(e.isPrimary===false||e.button!==0)return;
      const card=e.target.closest('.school');if(!card)return;
      clearCardPress();pressedCard=card;pressedPointer=e.pointerId;pressX=e.clientX;pressY=e.clientY;
      card.classList.add('is-pressed');
    },{passive:true});
    window.addEventListener('pointermove',e=>{
      if(pressedPointer!==e.pointerId)return;
      if((e.clientX-pressX)**2+(e.clientY-pressY)**2>100)clearCardPress();
    },{passive:true});
    window.addEventListener('pointerup',e=>{
      if(pressedPointer!==e.pointerId)return;
      pressedPointer=null;pressTimer=setTimeout(clearCardPress,120);
    },{passive:true});
    window.addEventListener('pointercancel',e=>{if(pressedPointer===e.pointerId)clearCardPress();},{passive:true});
    window.addEventListener('blur',clearCardPress);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)clearCardPress();});
    function countFilters(){
      const n=['indoor','outdoor'].filter(k=>$(controls[k]).value!=='all').length;
      $('filterCount').textContent=n?'（'+n+'）':'';
      $('qClear').hidden=!$('qName').value;
    }
    function chips(){
      const items=[];
      Object.entries(controls).forEach(([k,id])=>{
        const value=state.f[k];if(k==='q'?!value:value==='all')return;
        const label=k==='q'?value:$(id).selectedOptions[0]?.textContent||value;
        const b=document.createElement('button');b.type='button';b.className='query-chip';b.dataset.filter=k;
        b.setAttribute('aria-label','移除'+labels[k]+'：'+label);
        const text=document.createElement('span');text.textContent=labels[k]+'：'+label;b.append(text);
        const icon=document.createElement('span');icon.innerHTML=closeIcon;b.append(icon);
        b.onclick=()=>{clearTimeout(inputTimer);$(id).value=k==='q'?'':'all';apply(true);const target=(k==='indoor'||k==='outdoor')&&!$('qOptions').open?$('qOptions').querySelector('summary'):$(id);target.focus({preventScroll:true});};
        items.push(b);
      });
      $('qChips').replaceChildren(...items);$('qChips').hidden=!items.length;
    }
    function highlightedName(name){
      // Escape each segment before adding markup; user input is never HTML or a regex.
      const q=state.f.q.trim(),at=q?name.toLocaleLowerCase().indexOf(q.toLocaleLowerCase()):-1;
      return at<0?escape(name):escape(name.slice(0,at))+'<mark>'+escape(name.slice(at,at+q.length))+'</mark>'+escape(name.slice(at+q.length));
    }
    function render(announce=false){
      clearCardPress();
      window.SchoolMetal?.release();
      if(!state.data)return;
      const result=D.filter(state.rs,state.f),pages=Math.max(1,Math.ceil(result.length/PAGE_SIZE));
      state.page=Math.max(1,Math.min(state.page,pages));
      const scope=D.filter(state.rs,{district:state.f.district,group:state.f.group}),s=D.stats(scope);
      $('qSummary').textContent='查詢結果 '+result.length+' 所';
      $('qScope').textContent=(state.f.district==='all'?'全市':state.f.district)+'裝設覆蓋率 '+D.percent(s.index);
      $('qResults').innerHTML=result.length?result.slice((state.page-1)*PAGE_SIZE,state.page*PAGE_SIZE).map((r,i)=>'<article class="school" data-metal-eligible="'+(r.outdoor==='yes'&&r.indoor==='full'?'true':'false')+'" aria-labelledby="school-title-'+i+'"><div class="school-identity"><h3 id="school-title-'+i+'">'+highlightedName(r.name)+'</h3><p class="school-type">'+escape(r.district)+' · '+escape(r.type)+'</p></div><div class="school-visuals">'+visual('indoor',r.indoor)+visual('outdoor',r.outdoor)+'</div></article>').join(''):'<div class="empty"><h3>沒有符合的幼兒園</h3><p>請縮短園所名稱，或清除部分條件。</p></div>';
      $('qResults').setAttribute('aria-busy','false');
      document.dispatchEvent(new CustomEvent('school-cards:updated'));

      $('qPage').textContent='第 '+state.page+' 頁，共 '+pages+' 頁';$('qPrev').disabled=state.page<=1;$('qNext').disabled=state.page>=pages;
      $('qPagination').hidden=pages<=1;
      countFilters();chips();
      if(announce){
        $('qAnnounce').textContent='找到 '+result.length+' 所幼兒園，目前第 '+state.page+' 頁。';
      }
      if(onChange)onChange({...state.f},state.page);
    }
    function navigatePage(){
      // Keep pagination's existing heading destination.
      $('qSummary').focus({preventScroll:true});
      if(onNavigate)onNavigate($('qSummary').getBoundingClientRect().top+window.scrollY-20);
      else $('qSummary').scrollIntoView({block:'start',behavior:'instant'});
    }
    function showResults(){
      cancelResultNavigation();
      window.SchoolMetal?.release();
      if(!state.data||!$('qResults').querySelector('.school,.empty'))return;
      // Closing a mobile keyboard can scroll the document again after blur.
      // Keep this one navigation alive until browser scrolling has settled.
      if(document.activeElement?.matches('input'))document.activeElement.blur();
      const viewport=window.visualViewport,header=document.querySelector('.site-header');
      const userEvents=['pointerdown','touchstart','wheel','keydown'];
      let settleTimer,endTimer,observer,stopped=false,focusedCard=null;
      function position(behavior){
        const card=$('qResults').querySelector('.school,.empty');if(!card)return;
        const rect=card.getBoundingClientRect();
        const visibleTop=Math.max(0,viewport?.offsetTop||0);
        const visibleBottom=visibleTop+(viewport?.height||window.innerHeight);
        const coveredTop=Math.max(visibleTop,header?header.getBoundingClientRect().bottom:visibleTop);
        const remaining=visibleBottom-coveredTop-rect.height;
        const gap=remaining>=0?Math.min(16,remaining/2):16;
        const requestedTop=Math.max(0,rect.top+window.scrollY-coveredTop-gap);
        // An embedded caller owns its scroll range; keep its local coordinate.
        if(onNavigate){onNavigate(requestedTop);return;}
        const maxTop=Math.max(0,document.scrollingElement.scrollHeight-window.innerHeight);
        const top=Math.min(requestedTop,maxTop);
        if(Math.abs(window.scrollY-top)<=1)return;
        if(behavior==='smooth'){window.scrollTo({top,behavior});return;}
        // Override CSS smooth scrolling for an immediate correction on all engines.
        const style=document.documentElement.style;
        const previous=style.getPropertyValue('scroll-behavior'),priority=style.getPropertyPriority('scroll-behavior');
        style.setProperty('scroll-behavior','auto','important');
        window.scrollTo({top,behavior:'auto'});
        if(previous)style.setProperty('scroll-behavior',previous,priority);else style.removeProperty('scroll-behavior');
      }
      function settle(){
        if(stopped)return;
        const card=$('qResults').querySelector('.school,.empty');if(!card){stop();return;}
        // Move accessibility focus after the first movement, not while the input
        // still owns keyboard dismissal. Later native focus scrolling is checked too.
        if(focusedCard!==card){focusedCard=card;card.tabIndex=-1;card.focus({preventScroll:true});}
        position('auto');
      }
      function schedule(){if(stopped)return;clearTimeout(settleTimer);settleTimer=setTimeout(settle,120);}
      function focusChanged(event){if(event.target!==focusedCard)stop();}
      function stop(){
        if(stopped)return;stopped=true;
        clearTimeout(settleTimer);clearTimeout(endTimer);observer?.disconnect();
        window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);
        viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);
        userEvents.forEach(type=>document.removeEventListener(type,stop,true));
        document.removeEventListener('focusin',focusChanged,true);
        cancelResultNavigation=()=>{};
      }
      cancelResultNavigation=stop;
      // visualViewport.scroll alone misses document scrolls that preserve its offset.
      window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
      viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule);
      userEvents.forEach(type=>document.addEventListener(type,stop,{capture:true,passive:true}));
      document.addEventListener('focusin',focusChanged,true);
      if(window.ResizeObserver){
        observer=new ResizeObserver(schedule);
        [document.body,host,header].filter(Boolean).forEach(element=>observer.observe(element));
      }
      // Never take over normal reading: actual reader input cancels immediately.
      // No delay before the first jump; the deadline only bounds later corrections.
      endTimer=setTimeout(stop,2200);
      position(matchMedia('(pointer: coarse), (prefers-reduced-motion: reduce)').matches?'auto':'smooth');
      schedule();
    }
    function apply(announce=true){
      cancelResultNavigation();clearTimeout(inputTimer);if(!state.data)return;
      Object.entries(controls).forEach(([k,id])=>state.f[k]=$(id).value);state.page=1;render(announce);
    }
    $('qForm').addEventListener('submit',e=>{
      e.preventDefault();if(composing)return;apply(true);
      showResults();
      clearTimeout(feedbackTimer);$('qSubmit').textContent='已更新';$('qSubmit').classList.add('is-confirmed');
      feedbackTimer=setTimeout(()=>{$('qSubmit').textContent='查詢園所';$('qSubmit').classList.remove('is-confirmed');},1000);
    });
    $('qName').addEventListener('compositionstart',()=>{composing=true;clearTimeout(inputTimer);});
    $('qName').addEventListener('compositionend',()=>{composing=false;countFilters();clearTimeout(inputTimer);inputTimer=setTimeout(()=>apply(true),180);});
    $('qName').addEventListener('input',()=>{countFilters();clearTimeout(inputTimer);if(!composing)inputTimer=setTimeout(()=>apply(true),180);});
    ['district','group','indoor','outdoor'].forEach(k=>$(controls[k]).addEventListener('change',()=>apply(true)));
    $('qClear').onclick=()=>{$('qName').value='';apply(true);$('qName').focus({preventScroll:true});};
    $('qReset').onclick=()=>{clearTimeout(inputTimer);state.f=defaults();state.page=1;Object.entries(controls).forEach(([k,id])=>$(id).value=state.f[k]);render(true);$('qName').focus({preventScroll:true});};
    $('qPrev').onclick=()=>{state.page--;render(true);navigatePage();};$('qNext').onclick=()=>{state.page++;render(true);navigatePage();};
    return {
      setData(data){
        if(!D.validate(data))throw new Error('資料格式不符');
        if(!state.data)host.querySelectorAll('input,select,button').forEach(el=>el.disabled=false);
        state.data=data;state.rs=D.rows(data);const draft=$('qGroup').value;
        $('qGroup').innerHTML='<option value="all">全部類型</option>'+data.groups.map(g=>'<option value="'+escape(g.id)+'">'+escape(g.label)+'</option>').join('');
        $('qGroup').value=data.groups.some(g=>g.id===draft)?draft:'all';
        if(!data.groups.some(g=>g.id===state.f.group))state.f.group='all';
        render();
      },
      setFilter(f){cancelResultNavigation();clearTimeout(inputTimer);Object.entries(controls).forEach(([k,id])=>{if(f[k]!==undefined){$(id).value=f[k];state.f[k]=$(id).value||(k==='q'?'':'all');}});state.page=1;render(true);},
      setLarge(v){document.body.classList.toggle('large',!!v);},
      showResults,
      focus(){$('qName').focus({preventScroll:true});}
    };
  };
})(window);

