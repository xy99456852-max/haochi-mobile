export const repository = 'xy99456852-max/haochi-mobile';
const apiRoot = `https://api.github.com/repos/${repository}`;
export const tokenSettings = 'https://github.com/settings/personal-access-tokens/new';
export const publishStatus = `https://github.com/${repository}/actions`;
const photoPreviews=new Map();
export const displayPhoto=path=>photoPreviews.get(path)||path;
export function createStore(request=globalThis.fetch.bind(globalThis)) {
  let token='';
  async function api(path,method='GET',body) {
    const response=await request(apiRoot+path,{method,cache:'no-store',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok){
      const err=new Error(response.status===401?'编辑凭证无效或已过期，请重新连接。':response.status===403?'GitHub 拒绝保存，请检查此仓库的 Contents 读写权限，或稍后重试。':response.status===404?'找不到菜单或没有仓库权限。':`GitHub 请求失败（${response.status}），请重试。`);
      err.status=response.status; throw err;
    }
    return response.json();
  }
  function decode(content){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g,'')),c=>c.charCodeAt(0))));}
  async function readHead(){
    const ref=await api('/git/ref/heads/main');const sha=ref.object.sha;
    const [commit,file]=await Promise.all([api(`/git/commits/${sha}`),api(`/contents/data/menu.json?ref=${sha}`)]);
    const data=decode(file.content);if(!Array.isArray(data.items))throw Error('菜单数据格式错误');
    return {sha,tree:commit.tree.sha,items:data.items};
  }
  return {
    connected:()=>!!token,
    disconnect(){token='';},
    async connect(value){token=value.trim();if(!token)throw Error('请填写编辑凭证');try{const head=await readHead();return head.items;}catch(e){token='';throw e;}},
    async load(){
      if(token)return (await readHead()).items;
      const response=await request(new URL('./data/menu.json',globalThis.location?.href||'http://localhost/').href,{cache:'no-store'});
      if(!response.ok)throw Error('菜单加载失败，请稍后重试');const data=await response.json();if(!Array.isArray(data.items))throw Error('菜单数据格式错误');return data.items;
    },
    async mutate({item,id,original,photo}){
      if(!token)throw Error('请先连接编辑权限');
      for(let attempt=0;attempt<3;attempt++){
        const head=await readHead();const existing=head.items.find(i=>i.id===(id||item.id));
        if(JSON.stringify(existing)!==JSON.stringify(original))throw Error('这条记录已被其他人修改，请关闭编辑框并刷新菜单后再编辑。');
        const next=item?{...item,updated_at:new Date().toISOString()}:null;
        const tree=[];
        if(next&&photo){
          const blob=await api('/git/blobs','POST',{content:photo.content,encoding:'base64'});
          next.image=photo.path;
          for(const path of [`public/${photo.path}`,`docs/${photo.path}`])tree.push({path,mode:'100644',type:'blob',sha:blob.sha});
        }
        const items=next?[next,...head.items.filter(i=>i.id!==next.id)]:head.items.filter(i=>i.id!==id);
        const content=JSON.stringify({items},null,2)+'\n';
        for(const path of ['data/menu.json','docs/data/menu.json'])tree.push({path,mode:'100644',type:'blob',content});
        const createdTree=await api('/git/trees','POST',{base_tree:head.tree,tree});
        const commit=await api('/git/commits','POST',{message:next?`更新菜单：${next.name}`:`移除菜单：${existing?.name||id}`,tree:createdTree.sha,parents:[head.sha]});
        try{await api('/git/refs/heads/main','PATCH',{sha:commit.sha,force:false});if(photo)photoPreviews.set(photo.path,photo.preview);return {items,item:next,sha:commit.sha};}catch(e){if(![409,422].includes(e.status)||attempt===2)throw e;}
      }
    }
  };
}
export const menuStore=createStore();
export async function preparePhoto(file){
  if(file.size>10*1024*1024)throw Error('请选择小于 10MB 的图片');
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw Error('支持 JPG、PNG、WebP 和 GIF 图片');
  const url=URL.createObjectURL(file);let img;
  try{img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('图片无法读取，请换一张图片'));image.src=url;});}finally{URL.revokeObjectURL(url);}
  const canvas=document.createElement('canvas');const ratio=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const preview=canvas.toDataURL('image/jpeg',.84);return {preview,content:preview.split(',')[1],path:`photos/${crypto.randomUUID()}.jpg`};
}
