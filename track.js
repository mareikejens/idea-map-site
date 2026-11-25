// Tells Mareike's backend what a visitor looks at: which ideas they open, how long they stay on a card,
// and what goes into their jar. Each event carries the name from the first page, so a visit is useful
// even when the visitor never sends their jar. The welcome screen says so (see "notice" in content.js).
const Track=(()=>{
  const endpoint=window.IDEA_MAP.send?.trackEndpoint;
  let visitor='';
  try{visitor=sessionStorage.getItem('idea-map-visitor')||'';if(!visitor){visitor=Date.now().toString(36)+Math.random().toString(36).slice(2,8);sessionStorage.setItem('idea-map-visitor',visitor)}}catch{}
  // keepalive lets the request finish even while the page is closing.
  function send(type,data={}){
    if(!endpoint||location.protocol==='file:'||!visitor)return;
    try{fetch(endpoint,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},
      body:JSON.stringify({visitor,name:state.fullName,type,...data,jar:[...state.picked]})}).catch(()=>{})}catch{}
  }
  return {send,get visitor(){return visitor}};
})();
