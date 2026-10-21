"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, ArrowRight, Bookmark, Check, ChefHat, ChevronDown, ChevronRight, Clock3, Dice5, Flame, Heart, Leaf, MapPin, Pencil, Plus, Search, Settings2, Shuffle, Soup, Sparkles, Store, Trash2, Upload, Utensils, UtensilsCrossed, X } from "lucide-react";
import { baseCuisines, type MenuItem } from "../lib/menu";
import { menuStore, preparePhoto, displayPhoto, tokenSettings, publishStatus } from "./github-store.mjs";

type View = "discover" | "favorites" | "library";
type Tab = "dish" | "restaurant" | "cuisine";
type History = {name:string; kind:string; time:string};
type Result = {id:string;name:string;cuisine?:string;image?:string;price?:number;kind:string;description?:string;location?:string};

const blank = (kind:"dish"|"restaurant"):MenuItem => ({id:"new",kind,name:"",cuisine:"川湘菜",price:0,image:"",description:"",location:"",tags:"",spicy:0,demo:0});

function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();const el=ref.current;return()=>el?.close();},[]);
  return <dialog ref={ref} className={`modal ${wide?"wide":""}`} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-label={title}>
    <div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={21}/></button></div>{children}
  </dialog>;
}

function FoodImage({src,alt,...props}:{src?:string;alt:string;className?:string;loading?:"lazy"|"eager"}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  return src&&!failed?<img src={displayPhoto(src)} alt={alt} onError={()=>setFailed(true)} {...props}/>:<div className={`image-placeholder ${props.className||""}`}><Soup size={46}/><span>{alt}</span></div>;
}

export default function FoodApp() {
  const [items,setItems]=useState<MenuItem[]>([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const [signedIn,setSignedIn]=useState(false),[view,setView]=useState<View>("discover"),[tab,setTab]=useState<Tab>("dish");
  const [query,setQuery]=useState(""),[cuisine,setCuisine]=useState("全部"),[budget,setBudget]=useState("all"),[spicy,setSpicy]=useState("all"),[sort,setSort]=useState("default");
  const [favorites,setFavorites]=useState<string[]>([]),[history,setHistory]=useState<History[]>([]),[hydrated,setHydrated]=useState(false);
  const [randomMode,setRandomMode]=useState<Tab>("dish"),[rolling,setRolling]=useState(false),[avoidRepeat,setAvoidRepeat]=useState(true),[lastId,setLastId]=useState("");
  const [result,setResult]=useState<Result|null>(null),[detail,setDetail]=useState<MenuItem|null>(null),[edit,setEdit]=useState<MenuItem|null>(null),[confirmDelete,setConfirmDelete]=useState<MenuItem|null>(null);
  const [saving,setSaving]=useState(false),[uploading,setUploading]=useState(false),[formError,setFormError]=useState(""),[toast,setToast]=useState(""),[showHistory,setShowHistory]=useState(false);
  const [showConnect,setShowConnect]=useState(false),[credential,setCredential]=useState(""),[connecting,setConnecting]=useState(false),[connectError,setConnectError]=useState("");
  const [pendingPhoto,setPendingPhoto]=useState<any>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  async function load() {setLoading(true);setLoadError("");try{setItems(await menuStore.load());setSignedIn(menuStore.connected());}catch(e){setLoadError(e instanceof Error?e.message:"加载失败");}finally{setLoading(false);}}
  async function connect(e:React.FormEvent){e.preventDefault();if(connecting)return;setConnecting(true);setConnectError("");try{setItems(await menuStore.connect(credential));setCredential("");setSignedIn(true);setShowConnect(false);setToast("已连接编辑权限，仅在本次页面打开期间有效");}catch(e){setConnectError(e instanceof Error?e.message:"连接失败");}finally{setConnecting(false);}}
  useEffect(()=>{load();try{setFavorites(JSON.parse(localStorage.getItem("haochi-favorites")||"[]"));setHistory(JSON.parse(localStorage.getItem("haochi-history")||"[]"));}catch{}setHydrated(true);return()=>{if(timer.current)clearTimeout(timer.current);};},[]);
  useEffect(()=>{if(hydrated){try{localStorage.setItem("haochi-favorites",JSON.stringify(favorites));localStorage.setItem("haochi-history",JSON.stringify(history));}catch{}}},[favorites,history,hydrated]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(""),3200);return()=>clearTimeout(t);}},[toast]);
  const cuisines=useMemo(()=>Array.from(new Set([...baseCuisines,...items.map(i=>i.cuisine)])),[items]);
  const matches = (i:MenuItem) => (view!=="favorites"||favorites.includes(i.id))&&(view!=="library"||!i.demo)&&(cuisine==="全部"||i.cuisine===cuisine)&&(!query||`${i.name} ${i.cuisine} ${i.location} ${i.tags}`.toLowerCase().includes(query.toLowerCase()))&&(budget==="all"||(budget==="30"?i.price>0&&i.price<=30:budget==="60"?i.price>30&&i.price<=60:budget==="100"?i.price>60&&i.price<=100:i.price>100))&&(spicy==="all"||(spicy==="0"?i.spicy===0:i.spicy>0));
  const filtered=items.filter(matches);
  const display=filtered.filter(i=>i.kind===tab).sort((a,b)=>sort==="low"?a.price-b.price:sort==="high"?b.price-a.price:sort==="name"?a.name.localeCompare(b.name,"zh-CN"):0);
  const groups=cuisines.map(name=>({name,items:filtered.filter(i=>i.cuisine===name)})).filter(g=>g.items.length);
  const selectedCount=tab==="cuisine"?groups.length:display.length;
  const hasFilters=query||cuisine!=="全部"||budget!=="all"||spicy!=="all";
  function resetFilters(){setQuery("");setCuisine("全部");setBudget("all");setSpicy("all");}
  function navigate(next:View){setView(next);resetFilters();window.scrollTo({top:0,behavior:"smooth"});}
  function favorite(id:string){setFavorites(f=>f.includes(id)?f.filter(i=>i!==id):[...f,id]);}
  function openEdit(item?:MenuItem){setPendingPhoto(null);setFormError("");setDetail(null);setEdit(item?{...item}:blank(tab==="restaurant"?"restaurant":"dish"));}
  const randomPool:Result[]=randomMode==="cuisine"?groups.map(g=>({id:`cuisine-${g.name}`,kind:"cuisine",name:g.name,image:g.items[0]?.image,description:`菜单里有 ${g.items.filter(i=>i.kind==="dish").length} 道菜、${g.items.filter(i=>i.kind==="restaurant").length} 家饭店，去找找这一口的灵感。`})):filtered.filter(i=>i.kind===randomMode);
  function roll(){
    if(!randomPool.length){setToast("当前条件下没有候选，换个筛选试试吧");return;}
    if(rolling)return;
    setRolling(true);const pool=avoidRepeat&&randomPool.length>1?randomPool.filter(i=>i.id!==lastId):randomPool;
    const selected=pool[Math.floor(Math.random()*pool.length)];
    timer.current=setTimeout(()=>{setLastId(selected.id);setResult(selected);setRolling(false);setHistory(h=>[{name:selected.name,kind:selected.kind,time:new Date().toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})},...h].slice(0,20));},850);
  }
  async function upload(file?:File){
    if(!file||!edit)return;setFormError("");setUploading(true);
    try{const photo=await preparePhoto(file);setPendingPhoto(photo);setEdit(e=>e?{...e,image:photo.preview}:null);}catch(e){setFormError(e instanceof Error?e.message:"图片读取失败");}finally{setUploading(false);}
  }
  async function save(e:React.FormEvent){
    e.preventDefault();if(!edit||saving||uploading)return;setSaving(true);setFormError("");
    try{const isNew=edit.id==="new";const original=isNew?undefined:items.find(i=>i.id===edit.id);const item={...edit,id:isNew?crypto.randomUUID():edit.id,demo:0};const data=await menuStore.mutate({item,original,photo:pendingPhoto});setItems(data.items);setEdit(null);setPendingPhoto(null);setTab(data.item.kind);setView("library");resetFilters();setToast("已保存到 GitHub，其他手机将在重新发布后看到更新");}catch(e){setFormError(e instanceof Error?e.message:"保存失败");}finally{setSaving(false);}
  }
  async function remove(){
    if(!confirmDelete||saving)return;setSaving(true);try{const data=await menuStore.mutate({id:confirmDelete.id,original:items.find(i=>i.id===confirmDelete.id)});setItems(data.items);setFavorites(f=>f.filter(id=>id!==confirmDelete.id));setConfirmDelete(null);setDetail(null);setToast("已移除，正在重新发布菜单");}catch(e){setToast(e instanceof Error?e.message:"删除失败");}finally{setSaving(false);}
  }
  const titles={discover:"发现美味",favorites:"我的收藏",library:"我们的菜单"};
  return <div className="app-shell">
    <header className="mobile-header">
      <a className="brand" href="./" aria-label="好好吃饭首页"><span className="brand-icon"><Soup size={27}/></span><span>好好吃饭<small>GOOD FOOD, GOOD MOOD</small></span></a>
      <button className="header-history" onClick={()=>setShowHistory(true)} aria-label="最近吃什么"><Clock3 size={21}/><span>最近</span></button>
    </header>

    <div className="main-shell">
      <main>
        <div className="page-heading"><div><div className="eyebrow"><span className="orange-dot"/>每一餐，都值得期待</div><h1>{titles[view]}<span className="heading-period">.</span></h1></div><button className="primary add-button" onClick={()=>openEdit()}><Plus size={18}/>添加美味</button></div>

        {view==="discover"&&<div className="hero-row">
          <section className="hero"><div className="hero-copy"><span className="hero-label"><Leaf size={13}/>生活有滋味，每餐有期待</span><h2>今天吃什么？<br/>来点<span>新灵感</span>。</h2><p>收藏心动的菜，发现街角的小店。<br/>把选择的烦恼，变成一口小惊喜。</p><button className="hero-link" onClick={()=>document.getElementById("menu-explore")?.scrollIntoView({behavior:"smooth",block:"start"})}>发现你的下一顿 <ArrowRight size={16}/></button></div><div className="hero-photo-wrap"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><img className="hero-photo" src="./food/rice.jpg" alt="一碗丰盛的美味饭食"/><span className="photo-note note-top">每一口，都是小确幸 <Sparkles size={14}/></span><span className="photo-note note-bottom"><span>✦</span> 吃饱了，才有力气热爱生活</span><Leaf className="hero-leaf" size={39}/></div></section>
          <section className="random-panel"><div className="random-title"><span className="dice-icon"><Dice5 size={23}/></span><span>选择困难？交给我<small>LET FATE PICK YOUR PLATE</small></span></div><div className="random-modes" aria-label="随机抽选类型">{([['dish','一道菜'],['restaurant','一家店'],['cuisine','一种菜系']] as const).map(([key,label])=><button key={key} className={randomMode===key?"active":""} onClick={()=>setRandomMode(key)}>{label}</button>)}</div><p className="random-description">从当前筛选中，抽一份好心情</p><button className={`primary random-button ${rolling?"is-rolling":""}`} onClick={roll} disabled={rolling||loading||!!loadError}><Shuffle size={18}/>{rolling?"美味正在路上…":"帮我选一个"}<ArrowRight size={17}/></button><div className="random-bottom"><span>{randomPool.length} 个美味候选</span><label><input type="checkbox" checked={avoidRepeat} onChange={e=>setAvoidRepeat(e.target.checked)}/>避开上次</label></div></section>
        </div>}

        {view!=="discover"&&<div className="collection-banner"><span>{view==="favorites"?<Heart size={28}/>:<ChefHat size={30}/>}</span><div><h2>{view==="favorites"?"心动的美味，都在这里":"把你们的私藏，写进菜单"}</h2><p>{view==="favorites"?"点亮一颗爱心，下次想吃的时候就能找到。收藏保存在当前浏览器。":"菜品、饭店和照片保存在 GitHub，保存后需等待网站重新发布。"}</p></div><button className="secondary" onClick={roll}><Shuffle size={17}/>随机选{randomMode==="dish"?"道菜":randomMode==="restaurant"?"家店":"种菜系"}</button></div>}

        <div className="menu-management"><button className="secondary" onClick={()=>{if(signedIn){menuStore.disconnect();setSignedIn(false);setToast("已退出编辑");}else{setConnectError("");setShowConnect(true);}}}>{signedIn?"退出编辑":"管理菜单"}</button><button className="secondary" onClick={load}>刷新菜单</button>{signedIn&&<a href={publishStatus} target="_blank" rel="noopener noreferrer">查看发布进度</a>}</div>
        <section className="explore" id="menu-explore">
          <div className="explore-top"><div className="type-tabs" role="tablist" aria-label="浏览类型">{([['dish','想吃的菜',Soup],['restaurant','想去的店',Store],['cuisine','按菜系逛',UtensilsCrossed]] as const).map(([key,label,Icon])=><button key={key} role="tab" aria-selected={tab===key} className={tab===key?"active":""} onClick={()=>{setTab(key);setRandomMode(key);}}><Icon size={18}/>{label}<span>{key==="cuisine"?new Set(items.map(i=>i.cuisine)).size:items.filter(i=>i.kind===key&&(view!=="favorites"||favorites.includes(i.id))&&(view!=="library"||!i.demo)).length}</span></button>)}</div><label className="search-box"><Search size={17}/><input aria-label="搜索菜名、饭店或菜系" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索菜名、饭店或菜系…"/>{query&&<button aria-label="清除搜索" onClick={()=>setQuery("")}><X size={14}/></button>}</label></div>
          <div className="filters"><div className="cuisine-chips"><button className={cuisine==="全部"?"selected":""} onClick={()=>setCuisine("全部")}>全部口味</button>{cuisines.map(c=><button key={c} className={cuisine===c?"selected":""} onClick={()=>setCuisine(c)}>{c}</button>)}</div><div className="filter-selects"><label><Settings2 size={14}/><select aria-label="预算筛选" value={budget} onChange={e=>setBudget(e.target.value)}><option value="all">不限预算</option><option value="30">¥30 及以下</option><option value="60">¥31–60</option><option value="100">¥61–100</option><option value="over">¥100 以上</option></select><ChevronDown size={13}/></label><label><Flame size={14}/><select aria-label="辣度筛选" value={spicy} onChange={e=>setSpicy(e.target.value)}><option value="all">不限辣度</option><option value="0">不辣</option><option value="hot">想吃辣</option></select><ChevronDown size={13}/></label>{hasFilters&&<button className="reset-button" onClick={resetFilters}>重置</button>}</div></div>
          <div className="results-header"><p>{hasFilters?"为你找到":"美味清单"}<span>{selectedCount}</span>{tab==="restaurant"?"家小店":tab==="cuisine"?"种菜系":"道美味"}<span className="results-dot">·</span><small>总有一口，刚好合你心意</small></p><label className="sort-label"><ArrowDownUp size={14}/><select aria-label="排序方式" value={sort} onChange={e=>setSort(e.target.value)}><option value="default">默认排序</option><option value="low">价格从低到高</option><option value="high">价格从高到低</option><option value="name">按名称排序</option></select></label></div>

          {loading?<div className="loading-grid">{[1,2,3,4].map(i=><div key={i} className="skeleton-card"><div/><span/><span/></div>)}</div>:loadError?<div className="empty-state"><Soup size={42}/><h3>菜单暂时没有端上来</h3><p>{loadError}</p><button className="primary" onClick={load}>重新加载</button></div>:!selectedCount?<div className="empty-state"><Soup size={45}/><h3>{view==="favorites"&&!hasFilters?"还没有收藏，先去逛逛吧":view==="library"&&!hasFilters?"第一份私藏，等你添加":"没有找到这一口"}</h3><p>{hasFilters?"试着放宽预算、换个口味，更多美味正在等你。":"把喜欢的美味慢慢收集起来。"}</p><button className="primary" onClick={()=>hasFilters?resetFilters():view==="library"?openEdit():navigate("discover")}>{hasFilters?"清除筛选":view==="library"?"添加第一份美味":"去发现美味"}</button></div>:tab==="cuisine"?<div className="cuisine-grid">{groups.map((g,index)=><button className={`cuisine-card cuisine-tone-${index%4}`} key={g.name} onClick={()=>{setCuisine(g.name);setTab(g.items.some(i=>i.kind==="dish")?"dish":"restaurant");}}><FoodImage src={g.items[0].image} alt={g.name}/><div><span>FLAVORS TO EXPLORE</span><h3>{g.name}</h3><p>{g.items.filter(i=>i.kind==="dish").length} 道菜 · {g.items.filter(i=>i.kind==="restaurant").length} 家饭店</p></div><span className="cuisine-arrow"><ArrowRight size={19}/></span></button>)}</div>:<div className="food-grid">{display.map(item=><article key={item.id} className="food-card"><div className="card-photo"><button className="photo-button" onClick={()=>setDetail(item)} aria-label={`查看${item.name}`}><FoodImage src={item.image} alt={item.name} loading="lazy"/></button><span className="cuisine-badge">{item.cuisine}</span><button className={`favorite-button ${favorites.includes(item.id)?"favorited":""}`} onClick={()=>favorite(item.id)} aria-label={`${favorites.includes(item.id)?"取消收藏":"收藏"}${item.name}`} aria-pressed={favorites.includes(item.id)}><Heart size={18}/></button></div><div className="card-body"><div className="card-title"><button onClick={()=>setDetail(item)}><h3>{item.name}</h3></button><span className="price">{item.price>0?<><small>¥</small>{item.price}<em>/{item.kind==="restaurant"?"人":"份"}</em></>:<em>价格待填</em>}</span></div><p className="card-description">{item.description||"还没有写介绍，添加一句你的推荐吧。"}</p><div className="card-tags">{item.tags.split(/[,，]/).filter(Boolean).slice(0,2).map(t=><span key={t}>{t}</span>)}{item.spicy>0&&<span className="spicy-tag"><Flame size={11}/>{["","微辣","中辣","很辣"][item.spicy]}</span>}</div><div className="card-footer"><span>{item.kind==="restaurant"?<MapPin size={12}/>:<Store size={12}/>}<span>{item.location||(item.kind==="dish"?"自家私藏":"地址待添加")}</span>{!!item.demo&&<small>示例</small>}</span><button className="edit-button" onClick={()=>openEdit(item)} aria-label={`编辑${item.name}`}><Pencil size={13}/>编辑</button></div></div></article>)}<button className="add-card" onClick={()=>openEdit()}><span><Plus size={25}/></span><h3>还有什么好吃的？</h3><p>把你的私藏也加进来</p><small>添加{tab==="restaurant"?"一家小店":"一道美味"} <ArrowRight size={13}/></small></button></div>}
        </section>
        <footer className="page-footer"><span><Soup size={15}/>好好吃饭，好好生活。</span><p>示例菜品、饭店与价格仅供体验，可自由编辑替换。</p><span>WITH A LITTLE LOVE <Heart size={12}/></span></footer>
      </main>
    </div>

    <nav className="mobile-nav" aria-label="主导航">
      <button className={view==="discover"?"active":""} aria-current={view==="discover"?"page":undefined} onClick={()=>navigate("discover")}><UtensilsCrossed size={22}/><span>发现</span></button>
      <button className={view==="favorites"?"active":""} aria-current={view==="favorites"?"page":undefined} onClick={()=>navigate("favorites")}><span className="nav-icon"><Heart size={22}/>{items.some(i=>favorites.includes(i.id))&&<i/>}</span><span>收藏</span></button>
      <button className={view==="library"?"active":""} aria-current={view==="library"?"page":undefined} onClick={()=>navigate("library")}><Bookmark size={22}/><span>菜单</span></button>
      <button className="nav-add" onClick={()=>openEdit()}><span><Plus size={22}/></span><span>添加</span></button>
    </nav>

    {edit&&<Modal wide title={edit.id==="new"?"添一份美味灵感":"编辑这份美味"} onClose={()=>{if(!saving&&!uploading)setEdit(null);}}><form onSubmit={save} className="edit-form">
      <p className="form-intro">把想吃的菜、喜欢的小店，留在我们的菜单里。</p>
      {!signedIn&&<div className="signin-notice">连接编辑权限后即可保存菜单和图片。<button type="button" onClick={()=>{setConnectError("");setShowConnect(true);}}>连接编辑权限 <ArrowRight size={14}/></button></div>}
      <fieldset disabled={saving||uploading} className="form-fieldset"><div className="form-type">{([['dish','一道菜',Soup],['restaurant','一家店',Store]] as const).map(([key,label,Icon])=><button type="button" key={key} className={edit.kind===key?"active":""} onClick={()=>setEdit({...edit,kind:key})}><Icon size={18}/>{label}{edit.kind===key&&<Check size={15}/>}</button>)}</div>
      <label className={`upload-area ${edit.image?"has-photo":""}`}>{edit.image?<FoodImage src={edit.image} alt="菜单图片预览"/>:<Upload size={28}/>}<span className="upload-text"><strong>{uploading?"图片处理与压缩中…":edit.image?"点击更换图片":"上传一张美味照片"}</strong><small>最大 10MB，保存时自动压缩为 JPG</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="上传美味照片" disabled={!signedIn||uploading} onChange={e=>{upload(e.target.files?.[0]);e.target.value="";}}/></label>{edit.image&&<button type="button" className="remove-photo" onClick={()=>{setPendingPhoto(null);setEdit({...edit,image:""});}}>移除当前图片</button>}
      <div className="form-row"><label>名称 <b>*</b><input required autoComplete="off" maxLength={60} value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})} placeholder={edit.kind==="dish"?"例如：番茄牛腩饭":"例如：街角小食堂"}/></label><label>菜系 <b>*</b><input required list="cuisine-options" maxLength={30} value={edit.cuisine} onChange={e=>setEdit({...edit,cuisine:e.target.value})} placeholder="选择或输入新菜系"/><datalist id="cuisine-options">{cuisines.map(c=><option value={c} key={c}/>)}</datalist></label></div>
      <div className="form-row"><label>{edit.kind==="dish"?"单份价格（元）":"人均预算（元）"}<input type="number" min="0" max="100000" step="0.01" value={edit.price||""} onChange={e=>setEdit({...edit,price:Number(e.target.value)})} placeholder="选填，0 表示待定"/></label><label>辣度<select value={edit.spicy} onChange={e=>setEdit({...edit,spicy:Number(e.target.value)})}><option value={0}>不辣</option><option value={1}>微辣</option><option value={2}>中辣</option><option value={3}>很辣</option></select></label></div>
      <label>{edit.kind==="dish"?"在哪儿吃":"饭店地址"}<input maxLength={120} value={edit.location} onChange={e=>setEdit({...edit,location:e.target.value})} placeholder={edit.kind==="dish"?"饭店名称，也可以填“家里做”":"记下位置，下次不用再找"}/></label>
      <label>美味标签<input maxLength={120} value={edit.tags} onChange={e=>setEdit({...edit,tags:e.target.value})} placeholder="例如：一人食，朋友聚餐（用逗号分隔）"/></label><label>推荐理由<textarea maxLength={600} rows={3} value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})} placeholder="为什么喜欢这一口？随手记下来…"/></label></fieldset>
      {formError&&<p className="form-error" role="alert">{formError}</p>}<div className="form-actions"><span><span className="green-dot"/>保存后可随时编辑</span><button type="button" className="secondary" disabled={saving||uploading} onClick={()=>setEdit(null)}>取消</button><button className="primary" type="submit" disabled={saving||uploading||!signedIn}><Check size={17}/>{saving?"保存中…":"保存美味"}</button></div>
    </form></Modal>}

    {detail&&<Modal title={detail.kind==="dish"?"这一口，值得期待":"下一站，好好吃饭"} onClose={()=>setDetail(null)}><div className="detail-content"><FoodImage className="detail-image" src={detail.image} alt={detail.name}/><div className="detail-heading"><div><span className="detail-cuisine">{detail.cuisine}{!!detail.demo&&" · 示例"}</span><h2>{detail.name}</h2></div><button className={`favorite-button inline ${favorites.includes(detail.id)?"favorited":""}`} aria-label="收藏" onClick={()=>favorite(detail.id)}><Heart size={21}/></button></div><p>{detail.description||"添加一句推荐理由，让这份美味更有记忆。"}</p><div className="detail-meta"><span><MapPin size={16}/>{detail.location||"位置待添加"}</span><span>{detail.price?`¥${detail.price}/${detail.kind==="dish"?"份":"人"}`:"价格待填写"}</span></div><div className="card-tags">{detail.tags.split(/[,，]/).filter(Boolean).map(t=><span key={t}>{t}</span>)}</div><div className="detail-actions"><button className="danger-link" onClick={()=>setConfirmDelete(detail)}><Trash2 size={16}/>移除</button><button className="secondary" onClick={()=>openEdit(detail)}><Pencil size={16}/>编辑信息</button><button className="primary" onClick={()=>{setToast(`今天就吃${detail.name}，好好享用！`);setDetail(null);}}><Check size={17}/>就吃这个</button></div></div></Modal>}

    {result&&<Modal title="今日份的小惊喜" onClose={()=>{if(!rolling)setResult(null);}}><div className={`result-content ${rolling?"rolling":""}`}><div className="result-sparkles">✦ <span>THE DELICIOUS CHOICE IS…</span> ✦</div><FoodImage className="result-image" src={result.image} alt={result.name}/><span className="result-label">{result.kind==="dish"?"今天就吃这道菜":result.kind==="restaurant"?"今天就去这家店":"今天就试试这个菜系"}</span><h2>{rolling?"下一份美味正在路上…":result.name}</h2><div className="result-meta">{result.cuisine&&<span>{result.cuisine}</span>}{!!result.price&&<span>¥{result.price}/{result.kind==="dish"?"份":"人"}</span>}</div><p>{result.description}</p><div className="result-actions"><button className="secondary" disabled={rolling} onClick={roll}><Shuffle size={17}/>{rolling?"抽选中…":"再来一次"}</button><button className="primary" disabled={rolling} onClick={()=>{if(result.kind==="cuisine"){setCuisine(result.name);setTab(filtered.some(i=>i.cuisine===result.name&&i.kind==="dish")?"dish":"restaurant");}setToast(`今天就${result.kind==="restaurant"?"去":"吃"}${result.name}！`);setResult(null);}}><Check size={17}/>就它了！</button></div><small>每一次随机，都是与美味的偶遇</small></div></Modal>}

    {confirmDelete&&<Modal title="从菜单中移除？" onClose={()=>{if(!saving)setConfirmDelete(null);}}><div className="confirm-content"><p>确定移除「{confirmDelete.name}」吗？移除后不会再参与随机抽选。</p><div className="confirm-actions"><button className="secondary" disabled={saving} onClick={()=>setConfirmDelete(null)}>再想想</button><button className="danger-button" disabled={saving} onClick={remove}>{saving?"移除中…":"确认移除"}</button></div></div></Modal>}
    {showHistory&&<Modal title="最近的美味缘分" onClose={()=>setShowHistory(false)}><div className="history-content"><p>最近 20 次随机结果，记录在当前浏览器。</p>{history.length?history.map((h,i)=><div className="history-item" key={`${i}-${h.name}`}><span>{h.kind==="dish"?<Soup size={20}/>:h.kind==="restaurant"?<Store size={20}/>:<UtensilsCrossed size={20}/>}</span><div><h3>{h.name}</h3><small>{h.kind==="dish"?"一道菜":h.kind==="restaurant"?"一家店":"一种菜系"}</small></div><time>{h.time}</time></div>):<div className="empty-state"><Dice5 size={35}/><h3>美味的偶遇，从第一次开始</h3><p>试试“帮我选一个”，看看今天与谁有缘。</p></div>}</div></Modal>}
    {showConnect&&<Modal title="连接菜单编辑权限" onClose={()=>{if(!connecting){setShowConnect(false);setCredential("");}}}><form className="edit-form" onSubmit={connect}><p className="form-intro">浏览和随机选餐无需登录。管理员用 GitHub 编辑凭证连接后，可以修改共享菜单。</p><p className="auth-help">在 GitHub 创建仅授权 <strong>haochi-mobile</strong> 仓库的 Fine-grained token，设置 <strong>Contents: Read and write</strong>，并选择较短有效期。</p><a className="secondary" href={tokenSettings} target="_blank" rel="noopener noreferrer">在 GitHub 设置编辑凭证 <ArrowRight size={14}/></a><label>编辑凭证<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={credential} onChange={e=>setCredential(e.target.value)} placeholder="只在此处输入，不要发到聊天中"/></label><p className="auth-help">凭证仅保留在本页内存，关闭或刷新页面即清除，不会写入菜单或浏览器存储。菜单和照片公开可见。</p>{connectError&&<p className="form-error" role="alert">{connectError}</p>}<button className="primary" type="submit" disabled={connecting}>{connecting?"连接中…":"连接编辑权限"}</button></form></Modal>}
    {toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
  </div>;
}
