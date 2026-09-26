(function(){'use strict';var f,aa=typeof Object.create=="function"?Object.create:function(a){function b(){}
b.prototype=a;return new b},g=typeof Object.defineProperties=="function"?Object.defineProperty:function(a,b,c){if(a==Array.prototype||a==Object.prototype)return a;
a[b]=c.value;return a};
function ba(a){a=["object"==typeof globalThis&&globalThis,a,"object"==typeof window&&window,"object"==typeof self&&self,"object"==typeof global&&global];for(var b=0;b<a.length;++b){var c=a[b];if(c&&c.Math==Math)return c}throw Error("Cannot find global object");}
var ca=ba(this);function h(a,b){if(b)a:{var c=ca;a=a.split(".");for(var d=0;d<a.length-1;d++){var e=a[d];if(!(e in c))break a;c=c[e]}a=a[a.length-1];d=c[a];b=b(d);b!=d&&b!=null&&g(c,a,{configurable:!0,writable:!0,value:b})}}
var l;if(typeof Object.setPrototypeOf=="function")l=Object.setPrototypeOf;else{var m;a:{var da={a:!0},n={};try{n.__proto__=da;m=n.a;break a}catch(a){}m=!1}l=m?function(a,b){a.__proto__=b;if(a.__proto__!==b)throw new TypeError(a+" is not extensible");return a}:null}var p=l;
function ea(a){var b=0;return function(){return b<a.length?{done:!1,value:a[b++]}:{done:!0}}}
function r(){var a=fa,b=typeof Symbol!="undefined"&&Symbol.iterator&&a[Symbol.iterator];if(b)return b.call(a);if(typeof a.length=="number")return{next:ea(a)};throw Error(String(a)+" is not an iterable or ArrayLike");}
h("Symbol",function(a){function b(k){if(this instanceof b)throw new TypeError("Symbol is not a constructor");return new c(d+(k||"")+"_"+e++,k)}
function c(k,q){this.h=k;g(this,"description",{configurable:!0,writable:!0,value:q})}
if(a)return a;c.prototype.toString=function(){return this.h};
var d="jscomp_symbol_"+(Math.random()*1E9>>>0)+"_",e=0;return b});
h("Symbol.dispose",function(a){return a?a:Symbol("Symbol.dispose")});/*

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/
var t=this||self;function u(a){a=a.split(".");for(var b=t,c=0;c<a.length;c++)if(b=b[a[c]],b==null)return null;return b}
function v(a,b){a=a.split(".");for(var c=t,d;a.length&&(d=a.shift());)a.length||b===void 0?c[d]&&c[d]!==Object.prototype[d]?c=c[d]:c=c[d]={}:c[d]=b}
;function w(){this.B=this.B;this.D=this.D}
w.prototype.B=!1;w.prototype.dispose=function(){this.B||(this.B=!0,this.I())};
w.prototype[Symbol.dispose]=function(){this.dispose()};
w.prototype.I=function(){if(this.D)for(;this.D.length;)this.D.shift()()};var x=t.window,y,z,A=(x==null?void 0:(y=x.yt)==null?void 0:y.config_)||(x==null?void 0:(z=x.ytcfg)==null?void 0:z.data_)||{};v("yt.config_",A);function B(a){a=C(a);return typeof a==="string"&&a==="false"?!1:!!a}
function C(a,b){var c={};a=("EXPERIMENT_FLAGS"in A?A.EXPERIMENT_FLAGS:c)[a];return a!==void 0?a:b}
;var D=1E3/60,ha=Number(C("web_emulated_idle_callback_delay",300)||0),E=D-3,fa=[8,5,4,3,2,1,0];
function F(a){a=a===void 0?{}:a;w.call(this);var b=this;this.j=[];this.i={};this.G=this.h=0;this.F=this.m=!1;this.A=[];this.C=this.H=!1;var c=r(),d=c.next(),e;try{for(;!d.done;d=c.next())this.j[d.value]=[]}finally{d&&!d.done&&(e=c.return)&&e.call(c)}this.l=0;this.S=a.timeout||1;this.v=E;this.o=0;this.J=this.V.bind(this);this.R=this.W.bind(this);this.M=this.T.bind(this);this.N=this.U.bind(this);this.O=this.L.bind(this);this.P=function(){b.L(performance.now())};
this.K=!!window.requestIdleCallback&&!!window.cancelIdleCallback&&!B("disable_scheduler_requestIdleCallback");((this.u=a.useRaf!==!1&&!!window.requestAnimationFrame)||B("enable_scheduler_simulate_raf"))&&document.addEventListener("visibilitychange",this.J)}
F.prototype=aa(w.prototype);F.prototype.constructor=F;if(p)p(F,w);else for(var G in w)if(G!="prototype")if(Object.defineProperties){var H=Object.getOwnPropertyDescriptor(w,G);H&&Object.defineProperty(F,G,H)}else F[G]=w[G];function I(a,b){var c=Date.now();J(b);b=Date.now()-c;a.m||(a.v-=b)}
function K(a,b,c,d){++a.G;if(c===10)return I(a,b),a.G;var e=a.G;a.i[e]=b;a.m&&!d?a.A.push({id:e,priority:c}):(a.j[c].push(e),a.F||a.m||(a.h!==0&&L(a)!==a.o&&M(a),a.start()));return e}
function N(a){a.A.length=0;for(var b=5;b>=0;b--)a.j[b].length=0;a.j[8].length=0;a.i={};M(a)}
function L(a){var b=B("enable_scheduler_simulate_raf");if(a.j[8].length){if(a.C)return 4;if(b){if(!document.hidden)return a.u?3:5}else if(!document.hidden&&a.u)return 3}for(var c=5;c>=a.l;c--)if(a.j[c].length>0)return c>0?b?document.hidden?2:a.u?3:5:!document.hidden&&a.u?3:2:1;return 0}
function O(a){var b=u("yt.logging.errors.log");b&&b(a)}
function J(a){try{a()}catch(b){O(b)}}
function P(a){var b=r(),c=b.next(),d;try{for(;!c.done;c=b.next())if(a.j[c.value].length)return!0}finally{c&&!c.done&&(d=b.return)&&d.call(b)}return!1}
f=F.prototype;f.U=function(a){var b=void 0;a&&(b=a.timeRemaining());this.H=!0;Q(this,b);this.H=!1};
f.W=function(){Q(this)};
f.T=function(){R(this)};
f.L=function(a){this.C=!0;var b=L(this);b===4&&b!==this.o&&(M(this),this.start());Q(this,void 0,a);this.C=!1};
f.V=function(){document.hidden||R(this);this.h&&(M(this),this.start())};
function R(a){M(a);a.m=!0;for(var b=Date.now(),c=a.j[8];c.length;){var d=c.shift(),e=a.i[d];delete a.i[d];e&&J(e)}S(a);a.m=!1;P(a)&&a.start();a.v-=Date.now()-b}
function S(a){for(var b=0,c=a.A.length;b<c;b++){var d=a.A[b];a.j[d.priority].push(d.id)}a.A.length=0}
function Q(a,b,c){a.C&&a.o===4&&a.h||M(a);a.m=!0;b=Date.now()+(b||a.v);for(var d=a.j[5];d.length;){var e=d.shift(),k=a.i[e];delete a.i[e];if(k)try{k(c)}catch(ma){O(ma)}}for(d=a.j[4];d.length;)c=d.shift(),e=a.i[c],delete a.i[c],e&&J(e);d=a.H?0:1;d=a.l>d?a.l:d;if(!(Date.now()>=b)){do{a:{e=a;k=d;for(var q=3;q>=k;q--)for(c=e.j[q];c.length;){var X=c.shift(),Y=e.i[X];delete e.i[X];if(Y){c=Y;break a}}c=null}c&&J(c)}while(c&&Date.now()<b)}a.m=!1;S(a);a.v=E;P(a)&&a.start()}
f.start=function(){this.F=!1;if(this.h===0)switch(this.o=L(this),this.o){case 1:var a=this.N;this.h=this.K?window.requestIdleCallback(a,{timeout:3E3}):window.setTimeout(a,ha);break;case 2:this.h=window.setTimeout(this.R,this.S);break;case 3:this.h=window.requestAnimationFrame(this.O);break;case 4:this.h=window.setTimeout(this.M,0);break;case 5:this.h=window.setTimeout(this.P,D)}};
function M(a){if(a.h){switch(a.o){case 1:var b=a.h;a.K?window.cancelIdleCallback(b):window.clearTimeout(b);break;case 5:case 2:case 4:window.clearTimeout(a.h);break;case 3:window.cancelAnimationFrame(a.h)}a.h=0}}
f.I=function(){N(this);M(this);(this.u||B("enable_scheduler_simulate_raf"))&&document.removeEventListener("visibilitychange",this.J);w.prototype.I.call(this)};var T=u("yt.scheduler.instance.timerIdMap_")||{},U=Number(C("kevlar_tuner_scheduler_soft_state_timer_ms",800)||0),V=0,W=0;function Z(){var a=u("ytglobal.schedulerInstanceInstance_");if(!a||a.B)a=new F(("scheduler"in A?A.scheduler:void 0)||{}),v("ytglobal.schedulerInstanceInstance_",a);return a}
function ia(){ja();var a=u("ytglobal.schedulerInstanceInstance_");a&&(a&&typeof a.dispose=="function"&&a.dispose(),v("ytglobal.schedulerInstanceInstance_",null))}
function ja(){N(Z());for(var a in T)T.hasOwnProperty(a)&&delete T[Number(a)]}
function ka(a,b,c){if(!c)return c=c===void 0,-K(Z(),a,b,c);var d=window.setTimeout(function(){var e=K(Z(),a,b);T[d]=e},c);
return d}
function la(a){var b=Z();I(b,a)}
function na(a){var b=Z();if(a<0)delete b.i[-a];else{var c=T[a];c?(delete b.i[c],delete T[a]):window.clearTimeout(a)}}
function oa(){pa()}
function pa(){window.clearTimeout(V);Z().start()}
function qa(){var a=Z();M(a);a.F=!0;window.clearTimeout(V);V=window.setTimeout(oa,U)}
function ra(){window.clearTimeout(W);W=window.setTimeout(function(){sa(0)},U)}
function sa(a){ra();var b=Z();b.l=a;b.start()}
function ta(a){ra();var b=Z();b.l>a&&(b.l=a,b.start())}
function ua(){window.clearTimeout(W);var a=Z();a.l=0;a.start()}
;u("yt.scheduler.initialized")||(v("yt.scheduler.instance.dispose",ia),v("yt.scheduler.instance.addJob",ka),v("yt.scheduler.instance.addImmediateJob",la),v("yt.scheduler.instance.cancelJob",na),v("yt.scheduler.instance.cancelAllJobs",ja),v("yt.scheduler.instance.start",pa),v("yt.scheduler.instance.pause",qa),v("yt.scheduler.instance.setPriorityThreshold",sa),v("yt.scheduler.instance.enablePriorityThreshold",ta),v("yt.scheduler.instance.clearPriorityThreshold",ua),v("yt.scheduler.initialized",!0));}).call(this);
