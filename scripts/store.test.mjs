import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../src/github-store.mjs';
const seed={id:'one',kind:'dish',name:'测试菜',image:'food/rice.jpg',demo:1};
function fakeGitHub(){
  const state={head:'h1',items:[seed],trees:new Map(),commits:new Map(),calls:[],conflict:false};
  const ok=(data,status=200)=>({ok:status<400,status,json:async()=>data});
  const request=async(url,opts={})=>{
    const path=new URL(url).pathname.replace('/repos/xy99456852-max/haochi-mobile','');const body=opts.body?JSON.parse(opts.body):null;
    state.calls.push({path,opts,body});
    if(path==='/git/ref/heads/main')return ok({object:{sha:state.head}});
    if(path.startsWith('/git/commits/')&&opts.method==='GET')return ok({tree:{sha:'tree0'}});
    if(path==='/contents/data/menu.json')return ok({content:Buffer.from(JSON.stringify({items:state.items})).toString('base64')});
    if(path==='/git/blobs')return ok({sha:'blob1'});
    if(path==='/git/trees'){state.trees.set('t'+state.trees.size,body);return ok({sha:'t'+(state.trees.size-1)});}
    if(path==='/git/commits'){const sha='c'+state.commits.size;state.commits.set(sha,body);return ok({sha});}
    if(path==='/git/refs/heads/main'){
      assert.equal(body.force,false);
      if(state.conflict){state.conflict=false;state.head='h2';state.items=[...state.items,{id:'other',name:'另一人新增'}];return ok({},422);}
      const commit=state.commits.get(body.sha);assert.deepEqual(commit.parents,[state.head]);
      const tree=state.trees.get(commit.tree);state.items=JSON.parse(tree.tree.find(x=>x.path==='data/menu.json').content).items;state.head=body.sha;return ok({});
    }
    if(path.endsWith('/data/menu.json'))return ok({items:state.items});
    throw Error('Unexpected request '+path);
  };
  return {state,request};
}
test('public read needs no credential; editing requires one',async()=>{
  const {request,state}=fakeGitHub();const store=createStore(request);assert.equal((await store.load())[0].name,'测试菜');assert.equal(state.calls[0].opts.headers,undefined);await assert.rejects(store.mutate({item:seed}),/连接编辑/);
});
test('Chinese text and photo saved atomically in source and public directory',async()=>{
  const {request,state}=fakeGitHub();const store=createStore(request);await store.connect('test-only-credential');
  const result=await store.mutate({item:{...seed,name:'番茄牛腩'},original:seed,photo:{path:'photos/test.jpg',content:'dGVzdA==',preview:'data:image/jpeg;base64,dGVzdA=='}});
  assert.equal(result.item.name,'番茄牛腩');const tree=[...state.trees.values()][0].tree;assert.deepEqual(tree.map(x=>x.path),['public/photos/test.jpg','docs/photos/test.jpg','data/menu.json','docs/data/menu.json']);assert.equal(tree[2].content,tree[3].content);assert.equal(JSON.stringify(tree).includes('test-only-credential'),false);
  store.disconnect();assert.equal(store.connected(),false);await assert.rejects(store.mutate({item:seed}),/连接编辑/);
});
test('concurrent changes to another entry are preserved on retry',async()=>{
  const {request,state}=fakeGitHub();const store=createStore(request);await store.connect('fake');state.conflict=true;const result=await store.mutate({item:{...seed,name:'修改'},original:seed});assert.equal(result.items.length,2);assert.equal(result.items.find(i=>i.id==='other').name,'另一人新增');
});
test('same-entry conflicts stop before writing and deletion persists',async()=>{
  const {request,state}=fakeGitHub();const store=createStore(request);await store.connect('fake');state.items=[{...seed,name:'已被修改'}];await assert.rejects(store.mutate({item:seed,original:seed}),/其他人修改/);assert.equal(state.trees.size,0);await store.mutate({id:'one',original:state.items[0]});assert.equal(state.items.length,0);
});
test('invalid credentials are cleared',async()=>{
  const store=createStore(async()=>({ok:false,status:401,json:async()=>({})}));await assert.rejects(store.connect('fake'),/无效/);assert.equal(store.connected(),false);
});
