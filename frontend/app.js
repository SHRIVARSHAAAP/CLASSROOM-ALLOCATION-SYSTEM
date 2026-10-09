const $ = selector => document.querySelector(selector);
let token = sessionStorage.getItem('campusToken'), user, rooms = [];
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path, method = 'GET', data) {
  const response = await fetch('/api' + path, {method, headers: {'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token} : {})}, ...(data ? {body:JSON.stringify(data)} : {})});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}
function message(error) { $('#message').textContent = error ? error.message : ''; }
async function load() {
  rooms = await api('/rooms');
  $('#login').hidden = true; $('#dashboard').hidden = false; $('#logout').hidden = false;
  $('#portal').textContent = user.role.toUpperCase() + ' PORTAL';
  $('#welcome').textContent = 'Welcome, ' + user.name;
  $('#add').hidden = user.role !== 'admin'; $('#history').hidden = user.role !== 'admin';
  $('#stats').innerHTML = [['Total classrooms',rooms.length],['In service',rooms.filter(r=>r.active && !r.maintenance).length],['Maintenance',rooms.filter(r=>r.maintenance).length]].map(([label,count])=>`<div class="stat"><strong>${count}</strong>${label}</div>`).join('');
  renderRooms();
  if (user.role === 'admin') {
    const audit = await api('/audit');
    $('#audit').innerHTML = audit.length ? audit.map(a=>`<li>${escape(a.name)} · ${escape(a.action)} · ${escape(new Date(a.created).toLocaleString())}</li>`).join('') : '<li>No changes yet.</li>';
  }
}
function renderRooms() {
  const query = $('#search').value.toLowerCase();
  const filtered = rooms.filter(r=>[r.name,r.building,r.facilities].join(' ').toLowerCase().includes(query));
  $('#rooms').innerHTML = filtered.length ? filtered.map(r=>`<article class="card"><span class="tag ${!r.active||r.maintenance?'unavailable':''}">${r.maintenance?'Maintenance':r.active?'In service':'Inactive'}</span><h2>${escape(r.name)}</h2><p>${escape(r.building)} · Floor ${r.floor}<br>${r.capacity} seats<br>${escape(r.facilities||'No facilities listed')}</p>${user.role==='admin'?`<button data-edit="${r.id}">Edit classroom</button>`:''}</article>`).join('') : '<p>No classrooms found. Administrators can add classrooms to get started.</p>';
}
$('#login-form').addEventListener('submit', async event=>{
  event.preventDefault(); message();
  try { const result=await api('/login','POST',Object.fromEntries(new FormData(event.target))); token=result.token;user=result.user;sessionStorage.setItem('campusToken',token);event.target.reset();await load(); } catch(error){message(error);}
});
$('#logout').onclick=async()=>{try{await api('/logout','POST',{});}catch(error){message(error);}sessionStorage.removeItem('campusToken');location.reload();};
$('#search').oninput=renderRooms;
function edit(room) {
  const form=$('#room-form');form.reset();form.elements.id.value=room?.id||'';
  if(room) for(const key of ['name','building','floor','capacity','facilities']) form.elements[key].value=room[key];
  form.elements.active.checked=room?Boolean(room.active):true;form.elements.maintenance.checked=Boolean(room?.maintenance);
  $('#editor').showModal();
}
$('#add').onclick=()=>edit();
$('#rooms').onclick=event=>{const button=event.target.closest('[data-edit]');if(button) edit(rooms.find(r=>r.id===Number(button.dataset.edit)));};
$('#close').onclick=()=>$('#editor').close();
$('#room-form').onsubmit=async event=>{event.preventDefault();message();const form=event.target;const data=Object.fromEntries(new FormData(form));data.active=form.elements.active.checked;data.maintenance=form.elements.maintenance.checked;try{await api('/rooms'+(data.id?'/'+data.id:''),data.id?'PATCH':'POST',data);$('#editor').close();await load();}catch(error){message(error);}};
if(token) api('/me').then(async result=>{user=result;await load();}).catch(error=>{sessionStorage.removeItem('campusToken');token=null;message(error);});
