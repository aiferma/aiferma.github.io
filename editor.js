'use strict';
const el = id => document.getElementById(id);
const textDecoder = new TextDecoder();
let token = sessionStorage.getItem('aiferma:admin') || '';
let head = '', files = [], selected = '', mode = 'visual', selectedImage = null, busy = false;
const originals = new Map(), changes = new Map(), imageURLs = new Map();
const textFile = path => /\.(html|css|js|json|svg)$/.test(path);
function decode(value) { return textDecoder.decode(Uint8Array.from(atob(value), c => c.charCodeAt(0))); }
function encode(value) {
 const bytes = new TextEncoder().encode(value);
 let binary = '';
 for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
 return btoa(binary);
}
function fail(error) { el('editor-error').textContent = error.message; el('editor-error').hidden = false; }
async function api(action, data = {}) {
 const response = await fetch(window.AIFERMA_ENDPOINT, {
  method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
  body:JSON.stringify({action,token,...data}), redirect:'follow'
 });
 if (!response.ok) throw Error('Сервер временно недоступен.');
 const result = await response.json();
 if (!result.ok) throw Error(result.error || 'Не удалось выполнить запрос.');
 return result;
}
function status() {
 el('state').textContent = changes.size ? 'Изменено файлов: ' + changes.size + ' · ещё не опубликовано' : 'Все изменения опубликованы';
 el('publish').disabled = busy || !changes.size;
}
function setChange(path, content) {
 if (originals.get(path) === content) changes.delete(path);
 else changes.set(path, content);
 status();
}
async function fileContent(path) {
 if (changes.has(path)) return changes.get(path);
 if (originals.has(path)) return originals.get(path);
 const file = files.find(file => file.path === path);
 if (!file) throw Error('Файл не найден.');
 const result = await api('editorFile', {sha:file.sha});
 originals.set(path,result.content);
 return result.content;
}
function fillFiles() {
 el('file').replaceChildren();
 for (const file of files) {
  if (textFile(file.path)) el('file').add(new Option(file.path,file.path));
 }
 el('replacement').replaceChildren(new Option('Выберите изображение',''));
 for (const file of files.filter(file => /\.(png|jpe?g|webp|gif)$/.test(file.path))) {
  el('replacement').add(new Option(file.path,file.path));
 }
}
async function load() {
 const result = await api('editorLoad');
 head = result.head; files = result.files;
 originals.clear(); imageURLs.clear(); fillFiles();
 el('versions').replaceChildren();
 for (const version of result.versions) {
  const row = document.createElement('div'); row.className = 'version';
  const description = document.createElement('div');
  description.textContent = new Date(version.date).toLocaleString('ru-RU') + ' · ' + version.sha.slice(0,7) + '\n' + version.message;
  row.append(description);
  const button = document.createElement('button'); button.className = 'btn secondary';
  button.textContent = version.sha === head ? 'Текущая версия' : 'Восстановить';
  button.disabled = version.sha === head;
  button.onclick = () => restore(version);
  row.append(button); el('versions').append(row);
 }
 el('editor-login').hidden = true; el('editor-work').hidden = false;
 await openFile(files.some(file => file.path === selected) ? selected : 'index.html');
 status();
}
async function openFile(path) {
 selectedImage = null; selected = path; el('file').value = path;
 const value = decode(await fileContent(path)); el('code').value = value;
 const html = path.endsWith('.html');
 el('visual').disabled = !html;
 if (!html) mode = 'source';
 el('preview').hidden = mode !== 'visual'; el('code').hidden = mode !== 'source';
 el('mode-note').textContent = mode === 'visual' ? 'Нажмите на текст или картинку. Ссылки в предпросмотре отключены.' : 'Полное содержимое файла. Вопросы и подписи опросника находятся также в short-model.js и short-survey.js.';
 if (mode === 'visual') await preview(value);
}
let previewDocument;
async function preview(value) {
 previewDocument = new DOMParser().parseFromString(value,'text/html');
 previewDocument.body.querySelectorAll('*').forEach((node,index) => node.setAttribute('data-editor-id',String(index)));
 const displayed = previewDocument.cloneNode(true);
 displayed.querySelectorAll('script,base,meta[http-equiv],iframe,object,embed').forEach(node => node.remove());
 displayed.querySelectorAll('*').forEach(node => {
  for (const attribute of [...node.attributes]) if (attribute.name.startsWith('on')) node.removeAttribute(attribute.name);
 });
 const base = document.createElement('base'); base.href = 'https://aiferma.github.io/'; displayed.head.prepend(base);
 const policy = document.createElement('meta'); policy.httpEquiv = 'Content-Security-Policy';
 policy.content = "default-src 'none'; img-src https://aiferma.github.io data:; style-src https://aiferma.github.io 'unsafe-inline'; font-src https://aiferma.github.io; form-action 'none'";
 displayed.head.prepend(policy);
 // Use the changed stylesheets in preview, including unpublished edits.
 for (const link of [...displayed.querySelectorAll('link[rel="stylesheet"]')]) {
  const path = link.getAttribute('href').split('?')[0];
  if (files.some(file => file.path === path)) {
   const style = document.createElement('style'); style.textContent = decode(await fileContent(path)); link.replaceWith(style);
  }
 }
 for (const node of previewDocument.body.querySelectorAll('[data-editor-id]')) {
  const match = displayed.querySelector('[data-editor-id="'+node.getAttribute('data-editor-id')+'"]');
  if (!match) continue;
  if (node.tagName === 'IMG' && imageURLs.has(node.getAttribute('src'))) match.setAttribute('src',imageURLs.get(node.getAttribute('src')));
  if (!node.children.length && node.textContent.trim() && !node.matches('script,style,input,textarea,select,option')) match.setAttribute('contenteditable','true');
 }
 el('preview').onload = () => {
  const doc = el('preview').contentDocument;
  doc.addEventListener('submit',event => event.preventDefault());
  doc.addEventListener('click',event => {
   if (event.target.closest('a,button')) event.preventDefault();
   if (event.target.tagName === 'IMG') {
    selectedImage = event.target.getAttribute('data-editor-id');
    el('mode-note').textContent = 'Картинка выбрана. Выберите замену в списке слева.';
   }
  });
  doc.addEventListener('input',event => {
   const id = event.target.getAttribute('data-editor-id');
   const original = previewDocument.querySelector('[data-editor-id="'+id+'"]');
   if (!original) return;
   original.textContent = event.target.textContent;
   saveVisual();
  });
 };
 el('preview').srcdoc = '<!doctype html>\n' + displayed.documentElement.outerHTML;
}
function saveVisual() {
 const saved = previewDocument.cloneNode(true);
 saved.querySelectorAll('[data-editor-id]').forEach(node => node.removeAttribute('data-editor-id'));
 setChange(selected,encode('<!doctype html>\n' + saved.documentElement.outerHTML));
}
el('replacement').onchange = async () => {
 if (selectedImage === null) { fail(Error('Сначала нажмите на картинку в предпросмотре.')); return; }
 const path = el('replacement').value; if (!path) return;
 const original = previewDocument.querySelector('[data-editor-id="'+selectedImage+'"]');
 if (!original) return;
 original.setAttribute('src',path); original.removeAttribute('srcset');
 const shown = el('preview').contentDocument.querySelector('[data-editor-id="'+selectedImage+'"]');
 shown.setAttribute('src',imageURLs.get(path) || 'https://aiferma.github.io/'+path); shown.removeAttribute('srcset');
 saveVisual();
};
el('image').onchange = async () => {
 try {
  const file = el('image').files[0]; if (!file) return;
  if (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) || file.size > 2000000) throw Error('Выберите PNG, JPG, WebP или GIF до 2 МБ.');
  const extension = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[file.type];
  const path = 'assets/image-'+crypto.randomUUID()+'.'+extension;
  const data = await new Promise((resolve,reject) => {const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
  files.push({path,size:file.size}); changes.set(path,data.split(',')[1]); imageURLs.set(path,data);
  el('replacement').add(new Option(path,path)); status();
  el('mode-note').textContent = 'Изображение добавлено. Нажмите на картинку страницы и выберите замену.';
 } catch(error) { fail(error); }
};
el('code').oninput = () => setChange(selected,encode(el('code').value));
el('file').onchange = () => openFile(el('file').value).catch(fail);
el('visual').onclick = () => {mode='visual';openFile(selected).catch(fail);};
el('source').onclick = () => {mode='source';openFile(selected).catch(fail);};
el('discard').onclick = async () => {
 if (!confirm('Отменить неопубликованные изменения этого файла?')) return;
 changes.delete(selected); await openFile(selected); status();
};
el('editor-auth').onsubmit = async event => {
 event.preventDefault();
 try {
  const result = await api('login',{key:el('key').value.trim()});
  token=result.token; sessionStorage.setItem('aiferma:admin',token); el('key').value=''; await load();
 } catch(error) { fail(error); }
};
el('publish').onclick = () => {
 el('changed-list').textContent = [...changes.keys()].join(', ');
 el('publish-dialog').showModal();
};
el('publish-dialog').addEventListener('close',async () => {
 if (el('publish-dialog').returnValue !== 'publish') return;
 busy=true;status();el('editor-error').hidden=true;
 try {
  await api('editorPublish',{base:head,message:el('message').value,files:[...changes].map(([path,content])=>({path,content}))});
  changes.clear();await load();
  el('state').textContent='Версия сохранена. GitHub Pages публикует сайт. Проверьте результат через несколько минут.';
 } catch(error) { fail(error); }
 finally {busy=false;el('publish').disabled=!changes.size;}
});
async function restore(version) {
 if (busy) return;
 if (!confirm('Восстановить весь сайт до '+version.sha.slice(0,7)+'? Неопубликованные правки будут сброшены после успешного восстановления.')) return;
 busy=true;status();
 try {
  await api('editorRestore',{base:head,version:version.sha});
  changes.clear();await load();el('state').textContent='Версия восстановлена. GitHub Pages публикует сайт.';
 } catch(error) { fail(error); }
 finally {busy=false;el('publish').disabled=!changes.size;}
}
window.addEventListener('beforeunload',event => {if(changes.size){event.preventDefault();event.returnValue='';}});
if (token) load().catch(fail);
