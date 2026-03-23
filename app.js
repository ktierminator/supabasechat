const SUPABASE_URL = "YOUR_PROJECT_URL";
const SUPABASE_KEY = "YOUR_ANON_KEY";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null, currentRoom = null;

// DOM Selectors
const themeBtn = document.getElementById('theme-btn');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');
const messageInput = document.getElementById('message-input');
const fileInput = document.getElementById('file-input');
const messagesList = document.getElementById('messages-list');

// --- 1. THEME LOGIC ---
function initTheme() {
  const isDark = localStorage.getItem('theme') === 'dark';
  if (isDark) document.body.classList.add('dark-mode');
  updateIcons(isDark);

  themeBtn.addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    updateIcons(dark);
  });
}

function updateIcons(isDark) {
  sunIcon.classList.toggle('hidden', !isDark);
  moonIcon.classList.toggle('hidden', isDark);
}

// --- 2. ROOM LOGIC ---
async function handleCreate(e) {
  e.preventDefault();
  const user = document.getElementById('create-username').value.trim();
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { error } = await supabase.from('rooms').insert([{ code, creator: user }]);
  if (error) return alert("Error: " + error.message);
  startChat(user, code);
}

async function handleJoin(e) {
  e.preventDefault();
  const user = document.getElementById('join-username').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const { data } = await supabase.from('rooms').select('*').eq('code', code).single();
  if (!data) return alert("Room not found!");
  startChat(user, code);
}

function startChat(user, code) {
  currentUser = user; currentRoom = code;
  localStorage.setItem('chat_username', user);
  document.getElementById('room-code-display').innerText = `Room: ${code}`;
  document.getElementById('current-user-display').innerText = `You: ${user}`;
  document.getElementById('landing-view').classList.add('hidden');
  document.getElementById('chat-view').classList.remove('hidden');
  loadMessages();
  subscribe();
}

// --- 3. MESSAGES & MEDIA ---
async function loadMessages() {
  const { data } = await supabase.from('messages').select('*').eq('room_code', currentRoom).order('created_at');
  if (data) data.forEach(renderMessage);
}

function subscribe() {
  supabase.channel('room1').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_code=eq.${currentRoom}` }, 
  payload => renderMessage(payload.new)).subscribe();
}

async function sendMessage(e) {
  e.preventDefault();
  const text = messageInput.value.trim();
  const file = fileInput.files[0];
  if (!text && !file) return;

  document.getElementById('btn-send').disabled = true;
  let media_url = null;

  if (file) {
    document.getElementById('upload-indicator').classList.remove('hidden');
    const path = `${currentRoom}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('chat-media').upload(path, file);
    if (error) alert("Upload Error: " + error.message);
    else media_url = supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl;
  }

  await supabase.from('messages').insert([{
    room_code: currentRoom, username: currentUser, content: text,
    media_url, media_type: file ? (file.type.startsWith('video') ? 'video' : 'image') : null
  }]);

  messageInput.value = ''; fileInput.value = '';
  document.getElementById('file-preview-name').classList.add('hidden');
  document.getElementById('btn-send').disabled = false;
  document.getElementById('upload-indicator').classList.add('hidden');
}

function renderMessage(msg) {
  const isMe = msg.username === currentUser;
  const div = document.createElement('div');
  div.className = `message-wrapper ${isMe ? 'me' : 'other'}`;
  div.innerHTML = `
    <div class="message-sender">${msg.username}</div>
    <div class="message-bubble">
      ${msg.media_url ? `<div class="message-media">${msg.media_type==='video' ? `<video src="${msg.media_url}" controls></video>` : `<img src="${msg.media_url}"/>`}</div>` : ''}
      <p>${msg.content || ''}</p>
      <span class="message-time">${new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
    </div>`;
  messagesList.appendChild(div);
  messagesList.scrollTop = messagesList.scrollHeight;
}

// --- 4. INIT & EVENTS ---
initTheme();
document.getElementById('form-create').onsubmit = handleCreate;
document.getElementById('form-join').onsubmit = handleJoin;
document.getElementById('form-message').onsubmit = sendMessage;
document.getElementById('tab-join').onclick = () => { switchTab(true); };
document.getElementById('tab-create').onclick = () => { switchTab(false); };
fileInput.onchange = () => {
  document.getElementById('file-preview-name').classList.remove('hidden');
  document.getElementById('file-preview-name').querySelector('span').innerText = fileInput.files[0].name;
};
document.getElementById('btn-clear-file').onclick = () => { fileInput.value = ''; document.getElementById('file-preview-name').classList.add('hidden'); };
document.getElementById('btn-leave').onclick = () => location.reload();
document.getElementById('btn-copy-link').onclick = () => {
  navigator.clipboard.writeText(location.origin + location.pathname + '?room=' + currentRoom);
  alert("Link Copied!");
};

function switchTab(isJoin) {
  document.getElementById('tab-join').classList.toggle('active', isJoin);
  document.getElementById('tab-create').classList.toggle('active', !isJoin);
  document.getElementById('form-join').classList.toggle('hidden', !isJoin);
  document.getElementById('form-create').classList.toggle('hidden', isJoin);
}
