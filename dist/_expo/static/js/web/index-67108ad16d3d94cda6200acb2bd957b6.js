__d(function(g,r,i,a,m,_e,d){"use strict";function e(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(_e,'__esModule',{value:!0}),Object.defineProperty(_e,"default",{enumerable:!0,get:function(){return j}}),Object.defineProperty(_e,"AppleAuthProvider",{enumerable:!0,get:function(){return _.default}}),Object.defineProperty(_e,"EmailAuthProvider",{enumerable:!0,get:function(){return P.default}}),Object.defineProperty(_e,"PhoneAuthProvider",{enumerable:!0,get:function(){return y.default}}),Object.defineProperty(_e,"GoogleAuthProvider",{enumerable:!0,get:function(){return C.default}}),Object.defineProperty(_e,"GithubAuthProvider",{enumerable:!0,get:function(){return A.default}}),Object.defineProperty(_e,"TwitterAuthProvider",{enumerable:!0,get:function(){return E.default}}),Object.defineProperty(_e,"FacebookAuthProvider",{enumerable:!0,get:function(){return b.default}}),Object.defineProperty(_e,"PhoneMultiFactorGenerator",{enumerable:!0,get:function(){return h.default}}),Object.defineProperty(_e,"TotpMultiFactorGenerator",{enumerable:!0,get:function(){return l.default}}),Object.defineProperty(_e,"TotpSecret",{enumerable:!0,get:function(){return U.TotpSecret}}),Object.defineProperty(_e,"OAuthProvider",{enumerable:!0,get:function(){return w.default}}),Object.defineProperty(_e,"OIDCAuthProvider",{enumerable:!0,get:function(){return I.default}}),Object.defineProperty(_e,"PhoneAuthState",{enumerable:!0,get:function(){return N}}),Object.defineProperty(_e,"SDK_VERSION",{enumerable:!0,get:function(){return k}}),Object.defineProperty(_e,"firebase",{enumerable:!0,get:function(){return W}});var t=r(d[0]),n=r(d[1]),s=r(d[2]),o=e(r(d[3])),u=e(r(d[4])),h=e(r(d[5])),l=e(r(d[6])),c=e(r(d[7])),p=e(r(d[8])),f=r(d[9]),v=r(d[10]),_=e(r(d[11])),P=e(r(d[12])),b=e(r(d[13])),A=e(r(d[14])),C=e(r(d[15])),w=e(r(d[16])),I=e(r(d[17])),y=e(r(d[18])),E=e(r(d[19])),U=r(d[20]),F=e(r(d[21])),O=e(r(d[22])),R=r(d[23]),L=r(d[24]);Object.keys(L).forEach(function(e){'default'===e||Object.prototype.hasOwnProperty.call(_e,e)||Object.defineProperty(_e,e,{enumerable:!0,get:function(){return L[e]}})});const N={CODE_SENT:'sent',AUTO_VERIFY_TIMEOUT:'timeout',AUTO_VERIFIED:'verified',ERROR:'error'},S={AppleAuthProvider:_.default,EmailAuthProvider:P.default,PhoneAuthProvider:y.default,GoogleAuthProvider:C.default,GithubAuthProvider:A.default,TwitterAuthProvider:E.default,FacebookAuthProvider:b.default,PhoneMultiFactorGenerator:h.default,TotpMultiFactorGenerator:l.default,OAuthProvider:w.default,OIDCAuthProvider:I.default,PhoneAuthState:N,getMultiFactorResolver:f.getMultiFactorResolver,multiFactor:v.multiFactor},T='RNFBAuthModule';class M extends s.FirebaseModule{constructor(...e){super(...e),this._user=null,this._settings=null,this._authResult=!1,this._languageCode=this.native.APP_LANGUAGE[this.app._name],this._tenantId=null,this._projectPasswordPolicy=null,this._tenantPasswordPolicies={},this.languageCode||(this._languageCode=this.native.APP_LANGUAGE['[DEFAULT]']),this.native.APP_USER[this.app._name]&&this._setUser(this.native.APP_USER[this.app._name]),this.emitter.addListener(this.eventNameForApp('auth_state_changed'),e=>{this._setUser(e.user),this.emitter.emit(this.eventNameForApp('onAuthStateChanged'),this._user)}),this.emitter.addListener(this.eventNameForApp('phone_auth_state_changed'),e=>{const t=`phone:auth:${e.requestKey}:${e.type}`;this.emitter.emit(t,e.state)}),this.emitter.addListener(this.eventNameForApp('auth_id_token_changed'),e=>{this._setUser(e.user),this.emitter.emit(this.eventNameForApp('onIdTokenChanged'),this._user)}),this.native.addAuthStateListener(),this.native.addIdTokenListener(),t.isOther||this.native.configureAuthDomain()}get languageCode(){return this._languageCode}set languageCode(e){if(!(0,t.isString)(e)&&!(0,t.isNull)(e))throw new Error("firebase.auth().languageCode = (*) expected 'languageCode' to be a string or null value");null===e?(this._languageCode=this.native.APP_LANGUAGE[this.app._name],this.languageCode||(this._languageCode=this.native.APP_LANGUAGE['[DEFAULT]'])):this._languageCode=e,this.setLanguageCode(e)}get config(){return{}}get tenantId(){return this._tenantId}get settings(){return this._settings||(this._settings=new c.default(this)),this._settings}get currentUser(){return this._user}_setUser(e){return this._user=e?(0,t.createDeprecationProxy)(new p.default(this,e)):null,this._authResult=!0,this.emitter.emit(this.eventNameForApp('onUserChanged'),this._user),this._user}_setUserCredential(e){const n=(0,t.createDeprecationProxy)(new p.default(this,e.user));return this._user=n,this._authResult=!0,this.emitter.emit(this.eventNameForApp('onUserChanged'),this._user),{additionalUserInfo:e.additionalUserInfo,user:n}}async setLanguageCode(e){if(!(0,t.isString)(e)&&!(0,t.isNull)(e))throw new Error("firebase.auth().setLanguageCode(*) expected 'languageCode' to be a string or null value");await this.native.setLanguageCode(e),null===e?(this._languageCode=this.native.APP_LANGUAGE[this.app._name],this.languageCode||(this._languageCode=this.native.APP_LANGUAGE['[DEFAULT]'])):this._languageCode=e}async setTenantId(e){if(!(0,t.isString)(e))throw new Error("firebase.auth().setTenantId(*) expected 'tenantId' to be a string");this._tenantId=e,await this.native.setTenantId(e)}onAuthStateChanged(e){const n=(0,t.parseListenerOrObserver)(e),s=this.emitter.addListener(this.eventNameForApp('onAuthStateChanged'),n);return this._authResult&&Promise.resolve().then(()=>{n(this._user||null)}),()=>s.remove()}onIdTokenChanged(e){const n=(0,t.parseListenerOrObserver)(e),s=this.emitter.addListener(this.eventNameForApp('onIdTokenChanged'),n);return this._authResult&&Promise.resolve().then(()=>{n(this._user||null)}),()=>s.remove()}onUserChanged(e){const n=(0,t.parseListenerOrObserver)(e),s=this.emitter.addListener(this.eventNameForApp('onUserChanged'),n);return this._authResult&&Promise.resolve().then(()=>{n(this._user||null)}),()=>{s.remove()}}signOut(){return this.native.signOut().then(()=>{this._setUser()})}signInAnonymously(){return this.native.signInAnonymously().then(e=>this._setUserCredential(e))}signInWithPhoneNumber(e,n){return t.isAndroid?this.native.signInWithPhoneNumber(e,n||!1).then(e=>new o.default(this,e.verificationId)):this.native.signInWithPhoneNumber(e).then(e=>new o.default(this,e.verificationId))}verifyPhoneNumber(e,n,s){let o=s,h=60;return(0,t.isBoolean)(n)?o=n:h=n,new u.default(this,e,h,o)}verifyPhoneNumberWithMultiFactorInfo(e,t){return this.native.verifyPhoneNumberWithMultiFactorInfo(e.uid,t)}verifyPhoneNumberForMultiFactor(e){const{phoneNumber:t,session:n}=e;return this.native.verifyPhoneNumberForMultiFactor(t,n)}resolveMultiFactorSignIn(e,t,n){return this.native.resolveMultiFactorSignIn(e,t,n).then(e=>this._setUserCredential(e))}resolveTotpSignIn(e,t,n){return this.native.resolveTotpSignIn(e,t,n).then(e=>this._setUserCredential(e))}createUserWithEmailAndPassword(e,t){return this.native.createUserWithEmailAndPassword(e,t).then(e=>this._setUserCredential(e)).catch(e=>{if('auth/password-does-not-meet-requirements'===e.code)return this._recachePasswordPolicy().catch(()=>{}).then(()=>{throw e});throw e})}signInWithEmailAndPassword(e,t){return this.native.signInWithEmailAndPassword(e,t).then(e=>this._setUserCredential(e)).catch(e=>{if('auth/password-does-not-meet-requirements'===e.code)return this._recachePasswordPolicy().catch(()=>{}).then(()=>{throw e});throw e})}signInWithCustomToken(e){return this.native.signInWithCustomToken(e).then(e=>this._setUserCredential(e))}signInWithCredential(e){return this.native.signInWithCredential(e.providerId,e.token,e.secret).then(e=>this._setUserCredential(e))}revokeToken(e){return this.native.revokeToken(e)}sendPasswordResetEmail(e,t=null){return this.native.sendPasswordResetEmail(e,t)}sendSignInLinkToEmail(e,t={}){return this.native.sendSignInLinkToEmail(e,t)}isSignInWithEmailLink(e){return this.native.isSignInWithEmailLink(e)}signInWithEmailLink(e,t){return this.native.signInWithEmailLink(e,t).then(e=>this._setUserCredential(e))}confirmPasswordReset(e,t){return this.native.confirmPasswordReset(e,t).catch(e=>{if('auth/password-does-not-meet-requirements'===e.code)return this._recachePasswordPolicy().catch(()=>{}).then(()=>{throw e});throw e})}applyActionCode(e){return this.native.applyActionCode(e).then(e=>{this._setUser(e)})}checkActionCode(e){return this.native.checkActionCode(e)}fetchSignInMethodsForEmail(e){return this.native.fetchSignInMethodsForEmail(e)}verifyPasswordResetCode(e){return this.native.verifyPasswordResetCode(e)}useUserAccessGroup(e){return t.isAndroid?Promise.resolve():this.native.useUserAccessGroup(e)}getRedirectResult(){throw new Error('firebase.auth().getRedirectResult() is unsupported by the native Firebase SDKs.')}setPersistence(){throw new Error('firebase.auth().setPersistence() is unsupported by the native Firebase SDKs.')}signInWithPopup(e){return this.native.signInWithProvider(e.toObject()).then(e=>this._setUserCredential(e))}signInWithRedirect(e){return this.native.signInWithProvider(e.toObject()).then(e=>this._setUserCredential(e))}useDeviceLanguage(){throw new Error('firebase.auth().useDeviceLanguage() is unsupported by the native Firebase SDKs.')}useEmulator(e){if(!e||!(0,t.isString)(e)||!(0,t.isValidUrl)(e))throw new Error('firebase.auth().useEmulator() takes a non-empty string URL');let n=e;!('boolean'==typeof this.firebaseJson.android_bypass_emulator_url_remap&&this.firebaseJson.android_bypass_emulator_url_remap)&&t.isAndroid&&n&&(n.startsWith('http://localhost')&&(n=n.replace('http://localhost','http://10.0.2.2')),n.startsWith('http://127.0.0.1')&&(n=n.replace('http://127.0.0.1','http://10.0.2.2')));const s=n.match(/^http:\/\/([\w\d-.]+):(\d+)$/);if(!s)throw new Error('firebase.auth().useEmulator() unable to parse host and port from URL');const o=s[1],u=parseInt(s[2],10);return this.native.useEmulator(o,u),[o,u]}getMultiFactorResolver(e){return(0,f.getMultiFactorResolver)(this,e)}multiFactor(e){if(e.userId!==this.currentUser.userId)throw new Error('firebase.auth().multiFactor() only operates on currentUser');return new v.MultiFactorUser(this,e)}getCustomAuthDomain(){return this.native.getCustomAuthDomain()}}Object.assign(M.prototype,R.PasswordPolicyMixin);const k=F.default;var j=(0,s.createModuleNamespace)({statics:S,version:F.default,namespace:'auth',nativeModuleName:T,nativeEvents:['auth_state_changed','auth_id_token_changed','phone_auth_state_changed'],hasMultiAppSupport:!0,hasCustomUrlOrRegionSupport:!1,ModuleClass:M});const W=(0,s.getFirebaseRoot)();(0,n.setReactNativeModule)(T,O.default)},1017,[1082,1083,1084,1098,1099,1100,1101,1105,1106,1107,1104,1109,1110,1111,1112,1113,1114,1115,1116,1117,1102,1118,1119,1124,1103]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return t}});class t{constructor(t,n){this._auth=t,this._verificationId=n}confirm(t){return this._auth.native.confirmationResultConfirm(t).then(t=>this._auth._setUserCredential(t))}get verificationId(){return this._verificationId}}},1098,[]);
__d(function(g,r,_i,a,m,_e,d){"use strict";Object.defineProperty(_e,'__esModule',{value:!0}),Object.defineProperty(_e,"default",{enumerable:!0,get:function(){return n}});var e,t=r(d[0]),i=r(d[1]),s=(e=i)&&e.__esModule?e:{default:e};let o=0;class n{constructor(e,i,s,n){this._auth=e,this._reject=null,this._resolve=null,this._promise=null,this._jsStack=(new Error).stack,this._timeout=s||20,this._phoneAuthRequestId=o++,this._forceResending=n||!1,this._internalEvents={codeSent:`phone:auth:${this._phoneAuthRequestId}:onCodeSent`,verificationFailed:`phone:auth:${this._phoneAuthRequestId}:onVerificationFailed`,verificationComplete:`phone:auth:${this._phoneAuthRequestId}:onVerificationComplete`,codeAutoRetrievalTimeout:`phone:auth:${this._phoneAuthRequestId}:onCodeAutoRetrievalTimeout`},this._publicEvents={error:`phone:auth:${this._phoneAuthRequestId}:error`,event:`phone:auth:${this._phoneAuthRequestId}:event`,success:`phone:auth:${this._phoneAuthRequestId}:success`},this._subscribeToEvents(),t.isAndroid&&this._auth.native.verifyPhoneNumber(i,this._phoneAuthRequestId+'',this._timeout,this._forceResending),t.isIOS&&this._auth.native.verifyPhoneNumber(i,this._phoneAuthRequestId+'')}_subscribeToEvents(){const e=Object.keys(this._internalEvents);for(let t=0,i=e.length;t<i;t++){const i=e[t],s=this._auth.emitter.addListener(this._internalEvents[i],e=>{this[`_${i}Handler`](e),s.remove()})}}_addUserObserver(e){this._auth.emitter.addListener(this._publicEvents.event,e)}_emitToObservers(e){this._auth.emitter.emit(this._publicEvents.event,e)}_emitToErrorCb(e){const{error:t}=e;this._reject&&this._reject(t),this._auth.emitter.emit(this._publicEvents.error,t)}_emitToSuccessCb(e){this._resolve&&this._resolve(e),this._auth.emitter.emit(this._publicEvents.success,e)}_removeAllListeners(){setTimeout(()=>{Object.values(this._internalEvents).forEach(e=>{this._auth.emitter.removeAllListeners(e)}),Object.values(this._publicEvents).forEach(e=>{this._auth.emitter.removeAllListeners(e)})},0)}_promiseDeferred(){if(!this._promise){const{promise:e,resolve:i,reject:s}=(0,t.promiseDefer)();this._promise=e,this._resolve=i,this._reject=s}}_codeSentHandler(e){const i={verificationId:e.verificationId,code:null,error:null,state:'sent'};this._emitToObservers(i),t.isIOS&&this._emitToSuccessCb(i),t.isAndroid}_codeAutoRetrievalTimeoutHandler(e){const t={verificationId:e.verificationId,code:null,error:null,state:'timeout'};this._emitToObservers(t),this._emitToSuccessCb(t)}_verificationCompleteHandler(e){const t={verificationId:e.verificationId,code:e.code||null,error:null,state:'verified'};this._emitToObservers(t),this._emitToSuccessCb(t),this._removeAllListeners()}_verificationFailedHandler(e){const t={verificationId:e.verificationId,code:null,error:null,state:'error'};t.error=new s.default({userInfo:e.error},this._jsStack,'auth'),this._emitToObservers(t),this._emitToErrorCb(t),this._removeAllListeners()}on(e,i,s,o){if('state_changed'!==e)throw new Error("firebase.auth.PhoneAuthListener.on(*, _, _, _) 'event' must equal 'state_changed'.");if(!(0,t.isFunction)(i))throw new Error("firebase.auth.PhoneAuthListener.on(_, *, _, _) 'observer' must be a function.");if(this._addUserObserver(i),(0,t.isFunction)(s)){const e=this._auth.emitter.addListener(this._publicEvents.error,t=>{e.remove(),s(t)})}if((0,t.isFunction)(o)){const e=this._auth.emitter.addListener(this._publicEvents.success,t=>{e.remove(),o(t)})}return this}then(e){if(this._promiseDeferred(),this._promise)return this._promise.then.bind(this._promise)(e)}catch(e){if(this._promiseDeferred(),this._promise)return this._promise.catch.bind(this._promise)(e)}}},1099,[1082,1085]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return t}});class t{static FACTOR_ID='phone';constructor(){throw new Error('`new PhoneMultiFactorGenerator()` is not supported on the native Firebase SDKs.')}static assertion(t){const{token:n,secret:o}=t;return{token:n,secret:o}}}},1100,[]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return s}});var t=r(d[0]),n=r(d[1]),o=r(d[2]);class s{static FACTOR_ID='totp';constructor(){throw new Error('`new TotpMultiFactorGenerator()` is not supported on the native Firebase SDKs.')}static assertionForSignIn(n,s){return t.isOther?(0,o.getAuth)().native.assertionForSignIn(n,s):{uid:n,verificationCode:s}}static assertionForEnrollment(t,n){return{totpSecret:t.secretKey,verificationCode:n}}static async generateSecret(t,o){if(!t)throw new Error('Session is required to generate a TOTP secret.');const{secretKey:s}=await o.native.generateTotpSecret(t);return new n.TotpSecret(s,o)}}},1101,[1082,1102,1103]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"TotpSecret",{enumerable:!0,get:function(){return n}});var t=r(d[0]);class n{constructor(t,n){this.secretKey=t,this.auth=n}secretKey=null;async generateQrCodeUrl(n,s){return(0,t.isString)(n)&&(0,t.isString)(s)&&''!==n&&''!==s?this.auth.native.generateQrCodeUrl(this.secretKey,n,s):''}openInOtpApp(n){if((0,t.isString)(n)&&''!==!n)return this.auth.native.openInOtpApp(this.secretKey,n)}}},1102,[1082]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),e.getAuth=o,e.initializeAuth=function(t,u){if(t)return(0,n.getApp)(t.name).auth();return(0,n.getApp)().auth()},e.applyActionCode=async function(n,t){return n.applyActionCode.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.beforeAuthStateChanged=function(n,t,u){throw new Error('beforeAuthStateChanged is unsupported by the native Firebase SDKs')},e.checkActionCode=async function(n,t){return n.checkActionCode.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.confirmPasswordReset=async function(n,t,o){return n.confirmPasswordReset.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.connectAuthEmulator=function(n,t,o){n.useEmulator.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.createUserWithEmailAndPassword=async function(n,t,o){return n.createUserWithEmailAndPassword.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.fetchSignInMethodsForEmail=async function(n,t){return n.fetchSignInMethodsForEmail.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.getMultiFactorResolver=function(n,t){return n.getMultiFactorResolver.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.getRedirectResult=async function(n,t){throw new Error('getRedirectResult is unsupported by the native Firebase SDKs')},e.isSignInWithEmailLink=function(n,t){return n.isSignInWithEmailLink.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.onAuthStateChanged=function(n,t){return n.onAuthStateChanged.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.onIdTokenChanged=function(n,t){return n.onIdTokenChanged.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.revokeAccessToken=async function(n,t){throw new Error('revokeAccessToken() is only supported on Web')},e.sendPasswordResetEmail=async function(n,t,o){return n.sendPasswordResetEmail.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.sendSignInLinkToEmail=async function(n,t,o){return n.sendSignInLinkToEmail.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.setPersistence=async function(n,t){throw new Error('setPersistence is unsupported by the native Firebase SDKs')},e.signInAnonymously=async function(n){return n.signInAnonymously.call(n,u.MODULAR_DEPRECATION_ARG)},e.signInWithCredential=async function(n,t){return n.signInWithCredential.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.signInWithCustomToken=async function(n,t){return n.signInWithCustomToken.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.signInWithEmailAndPassword=async function(n,t,o){return n.signInWithEmailAndPassword.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.signInWithEmailLink=async function(n,t,o){return n.signInWithEmailLink.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.signInWithPhoneNumber=async function(n,t,o){return n.signInWithPhoneNumber.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.verifyPhoneNumber=function(n,t,o,c){return n.verifyPhoneNumber.call(n,t,o,c,u.MODULAR_DEPRECATION_ARG)},e.signInWithPopup=async function(n,t,o){return n.signInWithPopup.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.signInWithRedirect=async function(n,t,o){return n.signInWithRedirect.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.signOut=async function(n){return n.signOut.call(n,u.MODULAR_DEPRECATION_ARG)},e.updateCurrentUser=async function(n,t){throw new Error('updateCurrentUser is unsupported by the native Firebase SDKs')},e.useDeviceLanguage=function(n){throw new Error('useDeviceLanguage is unsupported by the native Firebase SDKs')},e.setLanguageCode=function(n,t){return n.setLanguageCode.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.useUserAccessGroup=function(n,t){return n.useUserAccessGroup.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.verifyPasswordResetCode=async function(n,t){return n.verifyPasswordResetCode.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.parseActionCodeURL=function(n){throw new Error('parseActionCodeURL is unsupported by the native Firebase SDKs')},e.deleteUser=async function(n){return n.delete.call(n,u.MODULAR_DEPRECATION_ARG)},e.getIdToken=async function(n,t){return n.getIdToken.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.getIdTokenResult=async function(n,t){return n.getIdTokenResult.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.linkWithCredential=async function(n,t){return n.linkWithCredential.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.linkWithPhoneNumber=async function(n,t,u){throw new Error('linkWithPhoneNumber is unsupported by the native Firebase SDKs')},e.linkWithPopup=async function(n,t,o){return n.linkWithPopup.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.linkWithRedirect=async function(n,t,o){return n.linkWithRedirect.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.multiFactor=function(n){return new t.MultiFactorUser(o(),n)},e.reauthenticateWithCredential=async function(n,t){return n.reauthenticateWithCredential.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.reauthenticateWithPhoneNumber=async function(n,t,u){throw new Error('reauthenticateWithPhoneNumber is unsupported by the native Firebase SDKs')},e.reauthenticateWithPopup=async function(n,t,o){return n.reauthenticateWithPopup.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.reauthenticateWithRedirect=async function(n,t,o){return n.reauthenticateWithRedirect.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.reload=async function(n){return n.reload.call(n,u.MODULAR_DEPRECATION_ARG)},e.sendEmailVerification=async function(n,t){return n.sendEmailVerification.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.unlink=async function(n,t){return n.unlink.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.updateEmail=async function(n,t){return n.updateEmail.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.updatePassword=async function(n,t){return n.updatePassword.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.updatePhoneNumber=async function(n,t){return n.updatePhoneNumber.call(n,t,u.MODULAR_DEPRECATION_ARG)},e.updateProfile=async function(n,{displayName:t,photoURL:o}){return n.updateProfile.call(n,{displayName:t,photoURL:o},u.MODULAR_DEPRECATION_ARG)},e.verifyBeforeUpdateEmail=async function(n,t,o){return n.verifyBeforeUpdateEmail.call(n,t,o,u.MODULAR_DEPRECATION_ARG)},e.getAdditionalUserInfo=function(n){return n.additionalUserInfo},e.getCustomAuthDomain=function(n){return n.getCustomAuthDomain.call(n,u.MODULAR_DEPRECATION_ARG)},e.validatePassword=async function(n,t){if(!n||!n.app)throw new Error("firebase.auth().validatePassword(*) 'auth' must be a valid Auth instance with an 'app' property. Received: undefined");if(null==t)throw new Error("firebase.auth().validatePassword(*) expected 'password' to be a non-null or a defined value.");return n.validatePassword.call(n,t,u.MODULAR_DEPRECATION_ARG)};var n=r(d[0]),t=r(d[1]),u=r(d[2]);function o(t){return t?(0,n.getApp)(t.name).auth():(0,n.getApp)().auth()}},1103,[1014,1104,1082]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),e.multiFactor=function(t){return new n(t)},Object.defineProperty(e,"MultiFactorUser",{enumerable:!0,get:function(){return n}});var t=r(d[0]);class n{constructor(t,n){this._auth=t,void 0===n&&(n=t.currentUser),this._user=n,this.enrolledFactors=n.multiFactor.enrolledFactors}getSession(){return this._auth.native.getSession()}async enroll(n,o){const{token:s,secret:u,totpSecret:l,verificationCode:c}=n;if(s&&u)await this._auth.native.finalizeMultiFactorEnrollment(s,u,o);else{if(!l||!c)throw new Error('Invalid multi-factor assertion provided for enrollment.');await this._auth.native.finalizeTotpEnrollment(l,c,o)}return(0,t.reload)(this._auth.currentUser)}async unenroll(n){if(await this._auth.native.unenrollMultiFactor(n),this._auth.currentUser)return(0,t.reload)(this._auth.currentUser)}}},1104,[1103]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return o}});var t=r(d[0]);class o{constructor(t){this._auth=t,this._forceRecaptchaFlowForTesting=!1,this._appVerificationDisabledForTesting=!1}get forceRecaptchaFlowForTesting(){return this._forceRecaptchaFlowForTesting}set forceRecaptchaFlowForTesting(o){t.isAndroid&&(this._forceRecaptchaFlowForTesting=o,this._auth.native.forceRecaptchaFlowForTesting(o))}get appVerificationDisabledForTesting(){return this._appVerificationDisabledForTesting}set appVerificationDisabledForTesting(t){this._appVerificationDisabledForTesting=t,this._auth.native.setAppVerificationDisabledForTesting(t)}setAutoRetrievedSmsCodeForPhoneNumber(o,s){return t.isAndroid?this._auth.native.setAutoRetrievedSmsCodeForPhoneNumber(o,s):Promise.resolve(null)}}},1105,[1082]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return n}});var t=r(d[0]);class n{constructor(t,n){this._auth=t,this._user=n}get displayName(){return this._user.displayName||null}get email(){return this._user.email||null}get emailVerified(){return this._user.emailVerified||!1}get isAnonymous(){return this._user.isAnonymous||!1}get metadata(){const{metadata:t}=this._user;return{lastSignInTime:new Date(t.lastSignInTime).toISOString(),creationTime:new Date(t.creationTime).toISOString()}}get multiFactor(){return this._user.multiFactor||null}get phoneNumber(){return this._user.phoneNumber||null}get tenantId(){return this._user.tenantId||null}get photoURL(){return this._user.photoURL||null}get providerData(){return this._user.providerData}get providerId(){return this._user.providerId}get uid(){return this._user.uid}delete(){return this._auth.native.delete().then(()=>{this._auth._setUser()})}getIdToken(t=!1){return this._auth.native.getIdToken(t)}getIdTokenResult(t=!1){return this._auth.native.getIdTokenResult(t)}linkWithCredential(t){return this._auth.native.linkWithCredential(t.providerId,t.token,t.secret).then(t=>this._auth._setUserCredential(t))}linkWithPopup(t){return this.linkWithRedirect(t)}linkWithRedirect(t){return this._auth.native.linkWithProvider(t.toObject()).then(t=>this._auth._setUserCredential(t))}reauthenticateWithCredential(t){return this._auth.native.reauthenticateWithCredential(t.providerId,t.token,t.secret).then(t=>this._auth._setUserCredential(t))}reauthenticateWithPopup(t){return this.reauthenticateWithRedirect(t)}reauthenticateWithRedirect(t){return this._auth.native.reauthenticateWithProvider(t.toObject()).then(t=>this._auth._setUserCredential(t))}reload(){return this._auth.native.reload().then(t=>{this._auth._setUser(t)})}sendEmailVerification(n){if((0,t.isObject)(n)){if(!(0,t.isString)(n.url))throw new Error("firebase.auth.User.sendEmailVerification(*) 'actionCodeSettings.url' expected a string value.");if(!(0,t.isUndefined)(n.linkDomain)&&!(0,t.isString)(n.linkDomain))throw new Error("firebase.auth.User.sendEmailVerification(*) 'actionCodeSettings.linkDomain' expected a string value.");if(!(0,t.isUndefined)(n.handleCodeInApp)&&!(0,t.isBoolean)(n.handleCodeInApp))throw new Error("firebase.auth.User.sendEmailVerification(*) 'actionCodeSettings.handleCodeInApp' expected a boolean value.");if(!(0,t.isUndefined)(n.iOS)){if(!(0,t.isObject)(n.iOS))throw new Error("firebase.auth.User.sendEmailVerification(*) 'actionCodeSettings.iOS' expected an object value.");if(!(0,t.isString)(n.iOS.bundleId))throw new Error("firebase.auth.User.sendEmailVerification(*) 'actionCodeSettings.iOS.bundleId' expected a string value.")}if(!(0,t.isUndefined)(n.android)){if(!(0,t.isObject)(n.android))throw new Error("firebase.auth.User.sendEmailVerification(*) 'actionCodeSettings.android' expected an object value.");if(!(0,t.isString)(n.android.packageName))throw new Error("firebase.auth.User.sendEmailVerification(*) 'actionCodeSettings.android.packageName' expected a string value.");if(!(0,t.isUndefined)(n.android.installApp)&&!(0,t.isBoolean)(n.android.installApp))throw new Error("firebase.auth.User.sendEmailVerification(*) 'actionCodeSettings.android.installApp' expected a boolean value.");if(!(0,t.isUndefined)(n.android.minimumVersion)&&!(0,t.isString)(n.android.minimumVersion))throw new Error("firebase.auth.User.sendEmailVerification(*) 'actionCodeSettings.android.minimumVersion' expected a string value.")}}return this._auth.native.sendEmailVerification(n).then(t=>{this._auth._setUser(t)})}toJSON(){return Object.assign({},this._user)}unlink(t){return this._auth.native.unlink(t).then(t=>this._auth._setUser(t))}updateEmail(t){return this._auth.native.updateEmail(t).then(t=>{this._auth._setUser(t)})}updatePassword(t){return this._auth.native.updatePassword(t).then(t=>{this._auth._setUser(t)})}updatePhoneNumber(t){return this._auth.native.updatePhoneNumber(t.providerId,t.token,t.secret).then(t=>{this._auth._setUser(t)})}updateProfile(t){return this._auth.native.updateProfile(t).then(t=>{this._auth._setUser(t)})}verifyBeforeUpdateEmail(n,s){if(!(0,t.isString)(n))throw new Error("firebase.auth.User.verifyBeforeUpdateEmail(*) 'newEmail' expected a string value.");if((0,t.isObject)(s)){if(!(0,t.isString)(s.url))throw new Error("firebase.auth.User.verifyBeforeUpdateEmail(_, *) 'actionCodeSettings.url' expected a string value.");if(!(0,t.isUndefined)(s.linkDomain)&&!(0,t.isString)(s.linkDomain))throw new Error("firebase.auth.User.verifyBeforeUpdateEmail(_, *) 'actionCodeSettings.linkDomain' expected a string value.");if(!(0,t.isUndefined)(s.handleCodeInApp)&&!(0,t.isBoolean)(s.handleCodeInApp))throw new Error("firebase.auth.User.verifyBeforeUpdateEmail(_, *) 'actionCodeSettings.handleCodeInApp' expected a boolean value.");if(!(0,t.isUndefined)(s.iOS)){if(!(0,t.isObject)(s.iOS))throw new Error("firebase.auth.User.verifyBeforeUpdateEmail(_, *) 'actionCodeSettings.iOS' expected an object value.");if(!(0,t.isString)(s.iOS.bundleId))throw new Error("firebase.auth.User.verifyBeforeUpdateEmail(_, *) 'actionCodeSettings.iOS.bundleId' expected a string value.")}if(!(0,t.isUndefined)(s.android)){if(!(0,t.isObject)(s.android))throw new Error("firebase.auth.User.verifyBeforeUpdateEmail(_, *) 'actionCodeSettings.android' expected an object value.");if(!(0,t.isString)(s.android.packageName))throw new Error("firebase.auth.User.verifyBeforeUpdateEmail(_, *) 'actionCodeSettings.android.packageName' expected a string value.");if(!(0,t.isUndefined)(s.android.installApp)&&!(0,t.isBoolean)(s.android.installApp))throw new Error("firebase.auth.User.verifyBeforeUpdateEmail(_, *) 'actionCodeSettings.android.installApp' expected a boolean value.");if(!(0,t.isUndefined)(s.android.minimumVersion)&&!(0,t.isString)(s.android.minimumVersion))throw new Error("firebase.auth.User.verifyBeforeUpdateEmail(_, *) 'actionCodeSettings.android.minimumVersion' expected a string value.")}}return this._auth.native.verifyBeforeUpdateEmail(n,s).then(t=>{this._auth._setUser(t)})}linkWithPhoneNumber(){throw new Error('firebase.auth.User.linkWithPhoneNumber() is unsupported by the native Firebase SDKs.')}reauthenticateWithPhoneNumber(){throw new Error('firebase.auth.User.reauthenticateWithPhoneNumber() is unsupported by the native Firebase SDKs.')}get refreshToken(){throw new Error('firebase.auth.User.refreshToken is unsupported by the native Firebase SDKs.')}}},1106,[1082]);
__d(function(g,r,i,a,m,_e,d){"use strict";Object.defineProperty(_e,'__esModule',{value:!0}),_e.getMultiFactorResolver=function(e,o){if(t.isOther)return e.native.getMultiFactorResolver(o);if(o.hasOwnProperty('userInfo')&&o.userInfo.hasOwnProperty('resolver')&&o.userInfo.resolver)return new u.default(e,o.userInfo.resolver);return null};var e,t=r(d[0]),o=r(d[1]),u=(e=o)&&e.__esModule?e:{default:e}},1107,[1082,1108]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return t}});class t{constructor(t,s){this._auth=t,this.hints=s.hints,this.session=s.session}resolveSignIn(t){const{token:s,secret:n,uid:o,verificationCode:u}=t;return s&&n?this._auth.resolveMultiFactorSignIn(this.session,s,n):this._auth.resolveTotpSignIn(this.session,o,u)}}},1108,[]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return n}});const t='apple.com';class n{constructor(){throw new Error('`new AppleAuthProvider()` is not supported on the native Firebase SDKs.')}static get PROVIDER_ID(){return t}static credential(n,o){return{token:n,secret:o,providerId:t}}}},1109,[]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return s}});const t='emailLink',n='password';class s{constructor(){throw new Error('`new EmailAuthProvider()` is not supported on the native Firebase SDKs.')}static get EMAIL_LINK_SIGN_IN_METHOD(){return t}static get EMAIL_PASSWORD_SIGN_IN_METHOD(){return n}static get PROVIDER_ID(){return n}static credential(t,s){return{token:t,secret:s,providerId:n}}static credentialWithLink(n,s){return{token:n,secret:s,providerId:t}}}},1110,[]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return o}});const t='facebook.com';class o{constructor(){throw new Error('`new FacebookAuthProvider()` is not supported on the native Firebase SDKs.')}static get PROVIDER_ID(){return t}static credential(o,n=""){return{token:o,secret:n,providerId:t}}}},1111,[]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return n}});const t='github.com';class n{constructor(){throw new Error('`new GithubAuthProvider()` is not supported on the native Firebase SDKs.')}static get PROVIDER_ID(){return t}static credential(n){return{token:n,secret:'',providerId:t}}}},1112,[]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return o}});const t='google.com';class o{constructor(){throw new Error('`new GoogleAuthProvider()` is not supported on the native Firebase SDKs.')}static get PROVIDER_ID(){return t}static credential(o,n){return{token:o,secret:n,providerId:t}}}},1113,[]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return t}});class t{#e=null;#t={};#r=[];constructor(t){this.#e=t}static credential(t,s){return{token:t,secret:s,providerId:'oauth'}}get PROVIDER_ID(){return this.#e}setCustomParameters(t){return this.#t=t,this}getCustomParameters(){return this.#t}addScope(t){return this.#r.includes(t)||this.#r.push(t),this}getScopes(){return[...this.#r]}toObject(){return{providerId:this.#e,scopes:this.#r,customParameters:this.#t}}}},1114,[]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return n}});const t='oidc.';class n{constructor(){throw new Error('`new OIDCAuthProvider()` is not supported on the native Firebase SDKs.')}static get PROVIDER_ID(){return t}static credential(n,o,c){return{token:o,secret:c,providerId:t+n}}}},1115,[]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return n}});const t='phone';class n{constructor(t){if(void 0===t)throw new Error('`new PhoneAuthProvider()` is not supported on the native Firebase SDKs.');this._auth=t}static get PROVIDER_ID(){return t}static credential(n,o){return{token:n,secret:o,providerId:t}}verifyPhoneNumber(t,n){return t.multiFactorHint?this._auth.app.auth().verifyPhoneNumberWithMultiFactorInfo(t.multiFactorHint,t.session):this._auth.app.auth().verifyPhoneNumberForMultiFactor(t)}}},1116,[]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return n}});const t='twitter.com';class n{constructor(){throw new Error('`new TwitterAuthProvider()` is not supported on the native Firebase SDKs.')}static get PROVIDER_ID(){return t}static credential(n,o){return{token:n,secret:o,providerId:t}}}},1117,[]);
__d(function(g,r,i,a,m,e,d){m.exports='23.8.8'},1118,[]);
__d(function(g,r,i,a,m,_e,d){"use strict";Object.defineProperty(_e,'__esModule',{value:!0}),Object.defineProperty(_e,"default",{enumerable:!0,get:function(){return A}}),r(d[0]);var e=r(d[1]),n=r(d[2]),t=r(d[3]);function s(e=!1){return e?o('no-current-user','No user currently signed in.'):Promise.resolve(null)}function o(e,t){return u((0,n.getWebError)({code:`auth/${e}`,message:t}))}function u(e){const{code:n,message:t,details:s}=e,o={code:n,message:t,userInfo:{code:n?n.replace('auth/',''):'unknown',message:t,details:s}};return Promise.reject(o)}function c(n){return Object.assign({},p(n),{emailVerified:n.emailVerified,isAnonymous:n.isAnonymous,tenantId:null!==n.tenantId&&''!==n.tenantId?n.tenantId:null,providerData:n.providerData.map(p),metadata:(t=n.metadata,{creationTime:t.creationTime?new Date(t.creationTime).toISOString():null,lastSignInTime:t.lastSignInTime?new Date(t.lastSignInTime).toISOString():null}),multiFactor:{enrolledFactors:(0,e.multiFactor)(n).enrolledFactors.map(h)}});var t}function l(n,t,s,o){if(t.startsWith('oidc.'))return new e.OAuthProvider(t).credential({idToken:s});switch(t){case'facebook.com':return(0,e.FacebookAuthProvider)().credential(s);case'google.com':return(0,e.GoogleAuthProvider)().credential(s,o);case'twitter.com':return(0,e.TwitterAuthProvider)().credential(s,o);case'github.com':return(0,e.GithubAuthProvider)().credential(s);case'apple.com':return new e.OAuthProvider(t).credential({idToken:s,rawNonce:o});case'oauth':return(0,e.OAuthProvider)(t).credential({idToken:s,accessToken:o});case'phone':return e.PhoneAuthProvider.credential(s,o);case'password':return e.EmailAuthProvider.credential(s,o);case'emailLink':return e.EmailAuthProvider.credentialWithLink(s,o);default:return null}}function p(e){return{providerId:e.providerId,uid:e.uid,displayName:null!==e.displayName&&''!==e.displayName?e.displayName:null,email:null!==e.email&&''!==e.email?e.email:null,photoURL:null!==e.photoURL&&''!==e.photoURL?e.photoURL:null,phoneNumber:null!==e.phoneNumber&&''!==e.phoneNumber?e.phoneNumber:null}}function h(e){const n={displayName:e.displayName,enrollmentTime:e.enrollmentTime,factorId:e.factorId,uid:e.uid};return'phoneNumber'in e&&(n.phoneNumber=e.phoneNumber),n}function y(n){const t=(0,e.getAdditionalUserInfo)(n);return{user:c(n.user),additionalUserInfo:{isNewUser:t.isNewUser,profile:t.profile,providerId:t.providerId,username:t.username}}}const f={},v={},w={},T=new Map,U=new Map;let I=0;function P(n){if(!f[n]){(0,t.isMemoryStorage)();const s={};f[n]=(0,e.initializeAuth)((0,e.getApp)(n),s)}return f[n]}var A=Object.assign({},{APP_LANGUAGE:{},APP_USER:{}},{async useUserAccessGroup(){},configureAuthDomain:()=>o('unsupported','This operation is not supported in this environment.'),getCustomAuthDomain:async()=>o('unsupported','This operation is not supported in this environment.'),addAuthStateListener(t){if(!v[t])return(0,n.guard)(async()=>{const s=P(t);v[t]=(0,e.onAuthStateChanged)(s,e=>{(0,n.emitEvent)('auth_state_changed',{appName:t,user:e?c(e):null})})})},removeAuthStateListener(e){v[e]&&(v[e](),delete v[e])},addIdTokenListener(t){if(!w[t])return(0,n.guard)(async()=>{const s=P(t);w[t]=(0,e.onIdTokenChanged)(s,e=>{(0,n.emitEvent)('auth_id_token_changed',{authenticated:!!e,appName:t,user:e?c(e):null})})})},removeIdTokenListener(e){w[e]&&(w[e](),delete w[e])},forceRecaptchaFlowForTesting:async()=>o('unsupported','This operation is not supported in this environment.'),setAutoRetrievedSmsCodeForPhoneNumber:async()=>o('unsupported','This operation is not supported in this environment.'),setAppVerificationDisabledForTesting:async()=>o('unsupported','This operation is not supported in this environment.'),signOut:e=>(0,n.guard)(async()=>{const n=P(e);return null===n.currentUser?s(!0):(await n.signOut(),s())}),signInAnonymously:t=>(0,n.guard)(async()=>{const n=P(t);return y(await(0,e.signInAnonymously)(n))}),createUserWithEmailAndPassword:async(t,s,o)=>(0,n.guard)(async()=>{const n=P(t);return y(await(0,e.createUserWithEmailAndPassword)(n,s,o))}),async signInWithEmailAndPassword(n,t,s){try{return y(await(0,e.signInWithEmailAndPassword)(P(n),t,s))}catch(e){throw e.userInfo={code:e.code.split('/')[1],message:e.message,customData:e.customData},e}},isSignInWithEmailLink:async(t,s)=>(0,n.guard)(async()=>{const n=P(t);return await(0,e.isSignInWithEmailLink)(n,s)}),signInWithEmailLink:async(t,s,o)=>(0,n.guard)(async()=>{const n=P(t);return y(await(0,e.signInWithEmailLink)(n,s,o))}),signInWithCustomToken:async(t,s)=>(0,n.guard)(async()=>{const n=P(t);return y(await(0,e.signInWithCustomToken)(n,s))}),revokeToken:async()=>s(),sendPasswordResetEmail:async(t,o,u)=>(0,n.guard)(async()=>{const n=P(t);return await(0,e.sendPasswordResetEmail)(n,o,u),s()}),sendSignInLinkToEmail:async(t,o,u)=>(0,n.guard)(async()=>{const n=P(t);return await(0,e.sendSignInLinkToEmail)(n,o,u),s()}),delete:async e=>(0,n.guard)(async()=>{const n=P(e);return null===n.currentUser?s(!0):(await n.currentUser.delete(),s())}),reload:async e=>(0,n.guard)(async()=>{const n=P(e);return null===n.currentUser?s(!0):(await n.currentUser.reload(),c(n.currentUser))}),sendEmailVerification:async(t,o)=>(0,n.guard)(async()=>{const n=P(t);return null===n.currentUser?s(!0):(await(0,e.sendEmailVerification)(n.currentUser,o),c(n.currentUser))}),verifyBeforeUpdateEmail:async(t,o,u)=>(0,n.guard)(async()=>{const n=P(t);return null===n.currentUser?s(!0):(await(0,e.verifyBeforeUpdateEmail)(n.currentUser,o,u),c(n.currentUser))}),updateEmail:async(t,o)=>(0,n.guard)(async()=>{const n=P(t);return null===n.currentUser?s(!0):(await(0,e.updateEmail)(n.currentUser,o),c(n.currentUser))}),updatePassword:async(t,o)=>(0,n.guard)(async()=>{const n=P(t);return null===n.currentUser?s(!0):(await(0,e.updatePassword)(n.currentUser,o),c(n.currentUser))}),updatePhoneNumber:async(t,u,p,h)=>(0,n.guard)(async()=>{const n=P(t);if(null===n.currentUser)return s(!0);if('phone'!==u)return o('invalid-credential','The supplied auth credential does not have a phone provider.');const y=l(0,u,p,h);return y?(await(0,e.updatePhoneNumber)(n.currentUser,y),c(n.currentUser)):o('invalid-credential','The supplied auth credential is malformed, has expired or is not currently supported.')}),updateProfile:async(t,o)=>(0,n.guard)(async()=>{const n=P(t);return null===n.currentUser?s(!0):(await(0,e.updateProfile)(n.currentUser,{displayName:o.displayName,photoURL:o.photoURL}),c(n.currentUser))}),signInWithCredential:async(t,s,u,c)=>(0,n.guard)(async()=>{const n=P(t),p=l(0,s,u,c);if(null===p)return o('invalid-credential','The supplied auth credential is malformed, has expired or is not currently supported.');return y(await(0,e.signInWithCredential)(n,p))}),signInWithProvider:async()=>o('unsupported','This operation is not supported in this environment.'),signInWithPhoneNumber:async()=>o('unsupported','This operation is not supported in this environment.'),getSession:async t=>(0,n.guard)(async()=>{const n=P(t);if(null===n.currentUser)return s(!0);const o=await(0,e.multiFactor)(n.currentUser).getSession();I++;const u=`${I}`;return T.set(u,o),u}),verifyPhoneNumberForMultiFactor:()=>o('unsupported','This operation is not supported in this environment.'),finalizeMultiFactorEnrollment:()=>o('unsupported','This operation is not supported in this environment.'),resolveMultiFactorSignIn:()=>o('unsupported','This operation is not supported in this environment.'),confirmationResultConfirm:()=>o('unsupported','This operation is not supported in this environment.'),verifyPhoneNumber:()=>o('unsupported','This operation is not supported in this environment.'),confirmPasswordReset:async(t,o,u)=>(0,n.guard)(async()=>{const n=P(t);return await(0,e.confirmPasswordReset)(n,o,u),s()}),applyActionCode:async(t,s)=>(0,n.guard)(async()=>{const n=P(t);await(0,e.applyActionCode)(n,s)}),checkActionCode:async(t,s)=>(0,n.guard)(async()=>{const n=P(t),o=await(0,e.checkActionCode)(n,s);return{operation:o.operation,data:{email:o.data.email,fromEmail:o.data.previousEmail}}}),linkWithCredential:async(t,u,c,p)=>(0,n.guard)(async()=>{const n=P(t),h=l(0,u,c,p);return null===h?o('invalid-credential','The supplied auth credential is malformed, has expired or is not currently supported.'):null===n.currentUser?s(!0):y(await(0,e.linkWithCredential)(n.currentUser,h))}),linkWithProvider:async()=>o('unsupported','This operation is not supported in this environment.'),unlink:async(t,o)=>(0,n.guard)(async()=>{const n=P(t);if(null===n.currentUser)return s(!0);return c(await(0,e.unlink)(n.currentUser,o))}),reauthenticateWithCredential:async(t,u,c,p)=>(0,n.guard)(async()=>{const n=P(t),h=l(0,u,c,p);return null===h?o('invalid-credential','The supplied auth credential is malformed, has expired or is not currently supported.'):null===n.currentUser?s(!0):y(await(0,e.reauthenticateWithCredential)(n.currentUser,h))}),reauthenticateWithProvider:async()=>o('unsupported','This operation is not supported in this environment.'),getIdToken:async(t,o)=>(0,n.guard)(async()=>{const n=P(t);if(null===n.currentUser)return s(!0);return await(0,e.getIdToken)(n.currentUser,o)}),getIdTokenResult:async(t,o)=>(0,n.guard)(async()=>{const n=P(t);if(null===n.currentUser)return s(!0);const u=await(0,e.getIdTokenResult)(n.currentUser,o);return{authTime:u.authTime,expirationTime:u.expirationTime,issuedAtTime:u.issuedAtTime,claims:u.claims,signInProvider:u.signInProvider,token:u.token}}),assertionForSignIn:(n,t,s)=>e.TotpMultiFactorGenerator.assertionForSignIn(t,s),getMultiFactorResolver:(n,t)=>(0,e.getMultiFactorResolver)(P(n),t),generateTotpSecret:async(t,s)=>(0,n.guard)(async()=>{const n=await e.TotpMultiFactorGenerator.generateSecret(T.get(s));return U.set(n.secretKey,n),{secretKey:n.secretKey}}),unenrollMultiFactor:async(t,o)=>(0,n.guard)(async()=>{const n=P(t);if(null===n.currentUser)return s(!0);await(0,e.multiFactor)(n.currentUser).unenroll(o)}),finalizeTotpEnrollment:async(t,o,u,c)=>(0,n.guard)(async()=>{const n=P(t);if(null===n.currentUser)return s(!0);const l=e.TotpMultiFactorGenerator.assertionForEnrollment(U.get(o),u);await(0,e.multiFactor)(n.currentUser).enroll(l,c)}),generateQrCodeUrl:(e,n,t,s)=>U.get(n).generateQrCodeUrl(t,s),openInOtpApp(){return e='unsupported',t='This operation is not supported in this environment.',Promise.reject((0,n.getWebError)({code:e,message:t}));var e,t},fetchSignInMethodsForEmail:async(t,s)=>(0,n.guard)(async()=>{const n=P(t);return await(0,e.fetchSignInMethodsForEmail)(n,s)}),setLanguageCode:(e,t)=>(0,n.guard)(async()=>{P(e).languageCode=t}),setTenantId:(e,t)=>(0,n.guard)(async()=>{P(e).tenantId=t}),useDeviceLanguage:t=>(0,n.guard)(async()=>{const n=P(t);(0,e.useDeviceLanguage)(n)}),verifyPasswordResetCode:(t,s)=>(0,n.guard)(async()=>{const n=P(t);return await(0,e.verifyPasswordResetCode)(n,s)}),useEmulator:(t,s,o)=>(0,n.guard)(async()=>{const n=P(t);(0,e.connectAuthEmulator)(n,`http://${s}:${o}`)})})},1119,[124,1120,1086,1127]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0});var t=r(d[0]);Object.keys(t).forEach(function(n){'default'===n||Object.prototype.hasOwnProperty.call(e,n)||Object.defineProperty(e,n,{enumerable:!0,get:function(){return t[n]}})});var n=r(d[1]);Object.keys(n).forEach(function(t){'default'===t||Object.prototype.hasOwnProperty.call(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:function(){return n[t]}})})},1120,[1087,1121]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0});var t=r(d[0]);Object.keys(t).forEach(function(n){'default'===n||Object.prototype.hasOwnProperty.call(e,n)||Object.defineProperty(e,n,{enumerable:!0,get:function(){return t[n]}})})},1121,[1122]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"ActionCodeOperation",{enumerable:!0,get:function(){return t.A}}),Object.defineProperty(e,"ActionCodeURL",{enumerable:!0,get:function(){return t.aj}}),Object.defineProperty(e,"AuthCredential",{enumerable:!0,get:function(){return t.M}}),Object.defineProperty(e,"AuthErrorCodes",{enumerable:!0,get:function(){return t.J}}),Object.defineProperty(e,"EmailAuthCredential",{enumerable:!0,get:function(){return t.N}}),Object.defineProperty(e,"EmailAuthProvider",{enumerable:!0,get:function(){return t.W}}),Object.defineProperty(e,"FacebookAuthProvider",{enumerable:!0,get:function(){return t.X}}),Object.defineProperty(e,"FactorId",{enumerable:!0,get:function(){return t.F}}),Object.defineProperty(e,"GithubAuthProvider",{enumerable:!0,get:function(){return t.Z}}),Object.defineProperty(e,"GoogleAuthProvider",{enumerable:!0,get:function(){return t.Y}}),Object.defineProperty(e,"OAuthCredential",{enumerable:!0,get:function(){return t.Q}}),Object.defineProperty(e,"OAuthProvider",{enumerable:!0,get:function(){return t._}}),Object.defineProperty(e,"OperationType",{enumerable:!0,get:function(){return t.O}}),Object.defineProperty(e,"PhoneAuthCredential",{enumerable:!0,get:function(){return t.U}}),Object.defineProperty(e,"PhoneAuthProvider",{enumerable:!0,get:function(){return t.P}}),Object.defineProperty(e,"PhoneMultiFactorGenerator",{enumerable:!0,get:function(){return t.n}}),Object.defineProperty(e,"ProviderId",{enumerable:!0,get:function(){return t.q}}),Object.defineProperty(e,"RecaptchaVerifier",{enumerable:!0,get:function(){return t.R}}),Object.defineProperty(e,"SAMLAuthProvider",{enumerable:!0,get:function(){return t.$}}),Object.defineProperty(e,"SignInMethod",{enumerable:!0,get:function(){return t.S}}),Object.defineProperty(e,"TotpMultiFactorGenerator",{enumerable:!0,get:function(){return t.T}}),Object.defineProperty(e,"TotpSecret",{enumerable:!0,get:function(){return t.o}}),Object.defineProperty(e,"TwitterAuthProvider",{enumerable:!0,get:function(){return t.a0}}),Object.defineProperty(e,"applyActionCode",{enumerable:!0,get:function(){return t.a8}}),Object.defineProperty(e,"beforeAuthStateChanged",{enumerable:!0,get:function(){return t.y}}),Object.defineProperty(e,"browserCookiePersistence",{enumerable:!0,get:function(){return t.a}}),Object.defineProperty(e,"browserLocalPersistence",{enumerable:!0,get:function(){return t.b}}),Object.defineProperty(e,"browserPopupRedirectResolver",{enumerable:!0,get:function(){return t.m}}),Object.defineProperty(e,"browserSessionPersistence",{enumerable:!0,get:function(){return t.c}}),Object.defineProperty(e,"checkActionCode",{enumerable:!0,get:function(){return t.a9}}),Object.defineProperty(e,"confirmPasswordReset",{enumerable:!0,get:function(){return t.a7}}),Object.defineProperty(e,"connectAuthEmulator",{enumerable:!0,get:function(){return t.L}}),Object.defineProperty(e,"createUserWithEmailAndPassword",{enumerable:!0,get:function(){return t.ab}}),Object.defineProperty(e,"debugErrorMap",{enumerable:!0,get:function(){return t.H}}),Object.defineProperty(e,"deleteUser",{enumerable:!0,get:function(){return t.G}}),Object.defineProperty(e,"fetchSignInMethodsForEmail",{enumerable:!0,get:function(){return t.ag}}),Object.defineProperty(e,"getAdditionalUserInfo",{enumerable:!0,get:function(){return t.ar}}),Object.defineProperty(e,"getAuth",{enumerable:!0,get:function(){return t.p}}),Object.defineProperty(e,"getIdToken",{enumerable:!0,get:function(){return t.ao}}),Object.defineProperty(e,"getIdTokenResult",{enumerable:!0,get:function(){return t.ap}}),Object.defineProperty(e,"getMultiFactorResolver",{enumerable:!0,get:function(){return t.at}}),Object.defineProperty(e,"getRedirectResult",{enumerable:!0,get:function(){return t.k}}),Object.defineProperty(e,"inMemoryPersistence",{enumerable:!0,get:function(){return t.V}}),Object.defineProperty(e,"indexedDBLocalPersistence",{enumerable:!0,get:function(){return t.i}}),Object.defineProperty(e,"initializeAuth",{enumerable:!0,get:function(){return t.K}}),Object.defineProperty(e,"initializeRecaptchaConfig",{enumerable:!0,get:function(){return t.v}}),Object.defineProperty(e,"isSignInWithEmailLink",{enumerable:!0,get:function(){return t.ae}}),Object.defineProperty(e,"linkWithCredential",{enumerable:!0,get:function(){return t.a3}}),Object.defineProperty(e,"linkWithPhoneNumber",{enumerable:!0,get:function(){return t.l}}),Object.defineProperty(e,"linkWithPopup",{enumerable:!0,get:function(){return t.e}}),Object.defineProperty(e,"linkWithRedirect",{enumerable:!0,get:function(){return t.h}}),Object.defineProperty(e,"multiFactor",{enumerable:!0,get:function(){return t.au}}),Object.defineProperty(e,"onAuthStateChanged",{enumerable:!0,get:function(){return t.z}}),Object.defineProperty(e,"onIdTokenChanged",{enumerable:!0,get:function(){return t.x}}),Object.defineProperty(e,"parseActionCodeURL",{enumerable:!0,get:function(){return t.ak}}),Object.defineProperty(e,"prodErrorMap",{enumerable:!0,get:function(){return t.I}}),Object.defineProperty(e,"reauthenticateWithCredential",{enumerable:!0,get:function(){return t.a4}}),Object.defineProperty(e,"reauthenticateWithPhoneNumber",{enumerable:!0,get:function(){return t.r}}),Object.defineProperty(e,"reauthenticateWithPopup",{enumerable:!0,get:function(){return t.f}}),Object.defineProperty(e,"reauthenticateWithRedirect",{enumerable:!0,get:function(){return t.j}}),Object.defineProperty(e,"reload",{enumerable:!0,get:function(){return t.as}}),Object.defineProperty(e,"revokeAccessToken",{enumerable:!0,get:function(){return t.E}}),Object.defineProperty(e,"sendEmailVerification",{enumerable:!0,get:function(){return t.ah}}),Object.defineProperty(e,"sendPasswordResetEmail",{enumerable:!0,get:function(){return t.a6}}),Object.defineProperty(e,"sendSignInLinkToEmail",{enumerable:!0,get:function(){return t.ad}}),Object.defineProperty(e,"setPersistence",{enumerable:!0,get:function(){return t.t}}),Object.defineProperty(e,"signInAnonymously",{enumerable:!0,get:function(){return t.a1}}),Object.defineProperty(e,"signInWithCredential",{enumerable:!0,get:function(){return t.a2}}),Object.defineProperty(e,"signInWithCustomToken",{enumerable:!0,get:function(){return t.a5}}),Object.defineProperty(e,"signInWithEmailAndPassword",{enumerable:!0,get:function(){return t.ac}}),Object.defineProperty(e,"signInWithEmailLink",{enumerable:!0,get:function(){return t.af}}),Object.defineProperty(e,"signInWithPhoneNumber",{enumerable:!0,get:function(){return t.s}}),Object.defineProperty(e,"signInWithPopup",{enumerable:!0,get:function(){return t.d}}),Object.defineProperty(e,"signInWithRedirect",{enumerable:!0,get:function(){return t.g}}),Object.defineProperty(e,"signOut",{enumerable:!0,get:function(){return t.D}}),Object.defineProperty(e,"unlink",{enumerable:!0,get:function(){return t.aq}}),Object.defineProperty(e,"updateCurrentUser",{enumerable:!0,get:function(){return t.C}}),Object.defineProperty(e,"updateEmail",{enumerable:!0,get:function(){return t.am}}),Object.defineProperty(e,"updatePassword",{enumerable:!0,get:function(){return t.an}}),Object.defineProperty(e,"updatePhoneNumber",{enumerable:!0,get:function(){return t.u}}),Object.defineProperty(e,"updateProfile",{enumerable:!0,get:function(){return t.al}}),Object.defineProperty(e,"useDeviceLanguage",{enumerable:!0,get:function(){return t.B}}),Object.defineProperty(e,"validatePassword",{enumerable:!0,get:function(){return t.w}}),Object.defineProperty(e,"verifyBeforeUpdateEmail",{enumerable:!0,get:function(){return t.ai}}),Object.defineProperty(e,"verifyPasswordResetCode",{enumerable:!0,get:function(){return t.aa}});var t=r(d[0]);r(d[1]),r(d[2]),r(d[3]),r(d[4])},1122,[1123,1088,1090,1091,1089]);
__d(function(e,t,n,r,i,s,a){"use strict";const o=["providerId"],c=["uid","auth","stsTokenManager"],u=["providerId","signInMethod"];Object.defineProperty(s,'__esModule',{value:!0}),Object.defineProperty(s,"$",{enumerable:!0,get:function(){return nn}}),Object.defineProperty(s,"A",{enumerable:!0,get:function(){return T}}),Object.defineProperty(s,"B",{enumerable:!0,get:function(){return ar}}),Object.defineProperty(s,"C",{enumerable:!0,get:function(){return or}}),Object.defineProperty(s,"D",{enumerable:!0,get:function(){return cr}}),Object.defineProperty(s,"E",{enumerable:!0,get:function(){return ur}}),Object.defineProperty(s,"F",{enumerable:!0,get:function(){return I}}),Object.defineProperty(s,"G",{enumerable:!0,get:function(){return dr}}),Object.defineProperty(s,"H",{enumerable:!0,get:function(){return w}}),Object.defineProperty(s,"I",{enumerable:!0,get:function(){return b}}),Object.defineProperty(s,"J",{enumerable:!0,get:function(){return S}}),Object.defineProperty(s,"K",{enumerable:!0,get:function(){return mt}}),Object.defineProperty(s,"L",{enumerable:!0,get:function(){return It}}),Object.defineProperty(s,"M",{enumerable:!0,get:function(){return Et}}),Object.defineProperty(s,"N",{enumerable:!0,get:function(){return Mt}}),Object.defineProperty(s,"O",{enumerable:!0,get:function(){return v}}),Object.defineProperty(s,"P",{enumerable:!0,get:function(){return mi}}),Object.defineProperty(s,"Q",{enumerable:!0,get:function(){return jt}}),Object.defineProperty(s,"R",{enumerable:!0,get:function(){return ai}}),Object.defineProperty(s,"S",{enumerable:!0,get:function(){return y}}),Object.defineProperty(s,"T",{enumerable:!0,get:function(){return bs}}),Object.defineProperty(s,"U",{enumerable:!0,get:function(){return Wt}}),Object.defineProperty(s,"V",{enumerable:!0,get:function(){return De}}),Object.defineProperty(s,"W",{enumerable:!0,get:function(){return Bt}}),Object.defineProperty(s,"X",{enumerable:!0,get:function(){return Qt}}),Object.defineProperty(s,"Y",{enumerable:!0,get:function(){return Zt}}),Object.defineProperty(s,"Z",{enumerable:!0,get:function(){return en}}),Object.defineProperty(s,"_",{enumerable:!0,get:function(){return Xt}}),Object.defineProperty(s,"a",{enumerable:!0,get:function(){return Ar}}),Object.defineProperty(s,"a0",{enumerable:!0,get:function(){return rn}}),Object.defineProperty(s,"a1",{enumerable:!0,get:function(){return cn}}),Object.defineProperty(s,"a2",{enumerable:!0,get:function(){return In}}),Object.defineProperty(s,"a3",{enumerable:!0,get:function(){return _n}}),Object.defineProperty(s,"a4",{enumerable:!0,get:function(){return yn}}),Object.defineProperty(s,"a5",{enumerable:!0,get:function(){return Tn}}),Object.defineProperty(s,"a6",{enumerable:!0,get:function(){return An}}),Object.defineProperty(s,"a7",{enumerable:!0,get:function(){return On}}),Object.defineProperty(s,"a8",{enumerable:!0,get:function(){return kn}}),Object.defineProperty(s,"a9",{enumerable:!0,get:function(){return Rn}}),Object.defineProperty(s,"aA",{enumerable:!0,get:function(){return Ji}}),Object.defineProperty(s,"aB",{enumerable:!0,get:function(){return Ge}}),Object.defineProperty(s,"aC",{enumerable:!0,get:function(){return N}}),Object.defineProperty(s,"aD",{enumerable:!0,get:function(){return U}}),Object.defineProperty(s,"aE",{enumerable:!0,get:function(){return Gi}}),Object.defineProperty(s,"aF",{enumerable:!0,get:function(){return Ne}}),Object.defineProperty(s,"aG",{enumerable:!0,get:function(){return Le}}),Object.defineProperty(s,"aH",{enumerable:!0,get:function(){return Wi}}),Object.defineProperty(s,"aI",{enumerable:!0,get:function(){return Di}}),Object.defineProperty(s,"aJ",{enumerable:!0,get:function(){return Ci}}),Object.defineProperty(s,"aK",{enumerable:!0,get:function(){return Ze}}),Object.defineProperty(s,"aL",{enumerable:!0,get:function(){return ke}}),Object.defineProperty(s,"aM",{enumerable:!0,get:function(){return Qe}}),Object.defineProperty(s,"aN",{enumerable:!0,get:function(){return Be}}),Object.defineProperty(s,"aO",{enumerable:!0,get:function(){return Cr}}),Object.defineProperty(s,"aP",{enumerable:!0,get:function(){return ls}}),Object.defineProperty(s,"aQ",{enumerable:!0,get:function(){return G}}),Object.defineProperty(s,"aR",{enumerable:!0,get:function(){return tn}}),Object.defineProperty(s,"aa",{enumerable:!0,get:function(){return Nn}}),Object.defineProperty(s,"ab",{enumerable:!0,get:function(){return Cn}}),Object.defineProperty(s,"ac",{enumerable:!0,get:function(){return Dn}}),Object.defineProperty(s,"ad",{enumerable:!0,get:function(){return Ln}}),Object.defineProperty(s,"ae",{enumerable:!0,get:function(){return Mn}}),Object.defineProperty(s,"af",{enumerable:!0,get:function(){return Un}}),Object.defineProperty(s,"ag",{enumerable:!0,get:function(){return Fn}}),Object.defineProperty(s,"ah",{enumerable:!0,get:function(){return Vn}}),Object.defineProperty(s,"ai",{enumerable:!0,get:function(){return xn}}),Object.defineProperty(s,"aj",{enumerable:!0,get:function(){return Kt}}),Object.defineProperty(s,"ak",{enumerable:!0,get:function(){return $t}}),Object.defineProperty(s,"al",{enumerable:!0,get:function(){return qn}}),Object.defineProperty(s,"am",{enumerable:!0,get:function(){return Wn}}),Object.defineProperty(s,"an",{enumerable:!0,get:function(){return zn}}),Object.defineProperty(s,"ao",{enumerable:!0,get:function(){return he}}),Object.defineProperty(s,"ap",{enumerable:!0,get:function(){return pe}}),Object.defineProperty(s,"aq",{enumerable:!0,get:function(){return hn}}),Object.defineProperty(s,"ar",{enumerable:!0,get:function(){return Zn}}),Object.defineProperty(s,"as",{enumerable:!0,get:function(){return Ee}}),Object.defineProperty(s,"at",{enumerable:!0,get:function(){return pr}}),Object.defineProperty(s,"au",{enumerable:!0,get:function(){return yr}}),Object.defineProperty(s,"av",{enumerable:!0,get:function(){return F}}),Object.defineProperty(s,"aw",{enumerable:!0,get:function(){return ze}}),Object.defineProperty(s,"ax",{enumerable:!0,get:function(){return He}}),Object.defineProperty(s,"ay",{enumerable:!0,get:function(){return R}}),Object.defineProperty(s,"az",{enumerable:!0,get:function(){return Is}}),Object.defineProperty(s,"b",{enumerable:!0,get:function(){return wr}}),Object.defineProperty(s,"c",{enumerable:!0,get:function(){return kr}}),Object.defineProperty(s,"d",{enumerable:!0,get:function(){return wi}}),Object.defineProperty(s,"e",{enumerable:!0,get:function(){return Pi}}),Object.defineProperty(s,"f",{enumerable:!0,get:function(){return bi}}),Object.defineProperty(s,"g",{enumerable:!0,get:function(){return Ui}}),Object.defineProperty(s,"h",{enumerable:!0,get:function(){return xi}}),Object.defineProperty(s,"i",{enumerable:!0,get:function(){return Jr}}),Object.defineProperty(s,"j",{enumerable:!0,get:function(){return Fi}}),Object.defineProperty(s,"k",{enumerable:!0,get:function(){return qi}}),Object.defineProperty(s,"l",{enumerable:!0,get:function(){return di}}),Object.defineProperty(s,"m",{enumerable:!0,get:function(){return vs}}),Object.defineProperty(s,"n",{enumerable:!0,get:function(){return ws}}),Object.defineProperty(s,"o",{enumerable:!0,get:function(){return Ss}}),Object.defineProperty(s,"p",{enumerable:!0,get:function(){return Ms}}),Object.defineProperty(s,"q",{enumerable:!0,get:function(){return _}}),Object.defineProperty(s,"r",{enumerable:!0,get:function(){return li}}),Object.defineProperty(s,"s",{enumerable:!0,get:function(){return ui}}),Object.defineProperty(s,"t",{enumerable:!0,get:function(){return er}}),Object.defineProperty(s,"u",{enumerable:!0,get:function(){return pi}}),Object.defineProperty(s,"v",{enumerable:!0,get:function(){return tr}}),Object.defineProperty(s,"w",{enumerable:!0,get:function(){return nr}}),Object.defineProperty(s,"x",{enumerable:!0,get:function(){return rr}}),Object.defineProperty(s,"y",{enumerable:!0,get:function(){return ir}}),Object.defineProperty(s,"z",{enumerable:!0,get:function(){return sr}});var d,l=t(a[0]),h=(d=l)&&d.__esModule?d:{default:d},p=t(a[1]),f=t(a[2]),m=t(a[3]),g=t(a[4]);
/**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
const I={PHONE:'phone',TOTP:'totp'},_={FACEBOOK:'facebook.com',GITHUB:'github.com',GOOGLE:'google.com',PASSWORD:'password',PHONE:'phone',TWITTER:'twitter.com'},y={EMAIL_LINK:'emailLink',EMAIL_PASSWORD:'password',FACEBOOK:'facebook.com',GITHUB:'github.com',GOOGLE:'google.com',PHONE:'phone',TWITTER:'twitter.com'},v={LINK:'link',REAUTHENTICATE:'reauthenticate',SIGN_IN:'signIn'},T={EMAIL_SIGNIN:'EMAIL_SIGNIN',PASSWORD_RESET:'PASSWORD_RESET',RECOVER_EMAIL:'RECOVER_EMAIL',REVERT_SECOND_FACTOR_ADDITION:'REVERT_SECOND_FACTOR_ADDITION',VERIFY_AND_CHANGE_EMAIL:'VERIFY_AND_CHANGE_EMAIL',VERIFY_EMAIL:'VERIFY_EMAIL'};function E(){return{"dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK."}}const w=
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
function(){return{"admin-restricted-operation":'This operation is restricted to administrators only.',"argument-error":'',"app-not-authorized":"This app, identified by the domain where it's hosted, is not authorized to use Firebase Authentication with the provided API key. Review your key configuration in the Google API console.","app-not-installed":"The requested mobile application corresponding to the identifier (Android package name or iOS bundle ID) provided is not installed on this device.","captcha-check-failed":"The reCAPTCHA response token provided is either invalid, expired, already used or the domain associated with it does not match the list of whitelisted domains.","code-expired":"The SMS code has expired. Please re-send the verification code to try again.","cordova-not-ready":'Cordova framework is not ready.',"cors-unsupported":'This browser is not supported.',"credential-already-in-use":'This credential is already associated with a different user account.',"custom-token-mismatch":'The custom token corresponds to a different audience.',"requires-recent-login":"This operation is sensitive and requires recent authentication. Log in again before retrying this request.","dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK.","dynamic-link-not-activated":"Please activate Dynamic Links in the Firebase Console and agree to the terms and conditions.","email-change-needs-verification":'Multi-factor users must always have a verified email.',"email-already-in-use":'The email address is already in use by another account.',"emulator-config-failed":"Auth instance has already been used to make a network call. Auth can no longer be configured to use the emulator. Try calling \"connectAuthEmulator()\" sooner.","expired-action-code":'The action code has expired.',"cancelled-popup-request":'This operation has been cancelled due to another conflicting popup being opened.',"internal-error":'An internal AuthError has occurred.',"invalid-app-credential":"The phone verification request contains an invalid application verifier. The reCAPTCHA token response is either invalid or expired.","invalid-app-id":'The mobile app identifier is not registered for the current project.',"invalid-user-token":"This user's credential isn't valid for this project. This can happen if the user's token has been tampered with, or if the user isn't for the project associated with this API key.","invalid-auth-event":'An internal AuthError has occurred.',"invalid-verification-code":"The SMS verification code used to create the phone auth credential is invalid. Please resend the verification code sms and be sure to use the verification code provided by the user.","invalid-continue-uri":'The continue URL provided in the request is invalid.',"invalid-cordova-configuration":"The following Cordova plugins must be installed to enable OAuth sign-in: cordova-plugin-buildinfo, cordova-universal-links-plugin, cordova-plugin-browsertab, cordova-plugin-inappbrowser and cordova-plugin-customurlscheme.","invalid-custom-token":'The custom token format is incorrect. Please check the documentation.',"invalid-dynamic-link-domain":'The provided dynamic link domain is not configured or authorized for the current project.',"invalid-email":'The email address is badly formatted.',"invalid-emulator-scheme":'Emulator URL must start with a valid scheme (http:// or https://).',"invalid-api-key":'Your API key is invalid, please check you have copied it correctly.',"invalid-cert-hash":'The SHA-1 certificate hash provided is invalid.',"invalid-credential":'The supplied auth credential is incorrect, malformed or has expired.',"invalid-message-payload":"The email template corresponding to this action contains invalid characters in its message. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-multi-factor-session":'The request does not contain a valid proof of first factor successful sign-in.',"invalid-oauth-provider":"EmailAuthProvider is not supported for this operation. This operation only supports OAuth providers.","invalid-oauth-client-id":"The OAuth client ID provided is either invalid or does not match the specified API key.","unauthorized-domain":"This domain is not authorized for OAuth operations for your Firebase project. Edit the list of authorized domains from the Firebase console.","invalid-action-code":"The action code is invalid. This can happen if the code is malformed, expired, or has already been used.","wrong-password":'The password is invalid or the user does not have a password.',"invalid-persistence-type":'The specified persistence type is invalid. It can only be local, session or none.',"invalid-phone-number":"The format of the phone number provided is incorrect. Please enter the phone number in a format that can be parsed into E.164 format. E.164 phone numbers are written in the format [+][country code][subscriber number including area code].","invalid-provider-id":'The specified provider ID is invalid.',"invalid-recipient-email":"The email corresponding to this action failed to send as the provided recipient email address is invalid.","invalid-sender":"The email template corresponding to this action contains an invalid sender email or name. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-verification-id":'The verification ID used to create the phone auth credential is invalid.',"invalid-tenant-id":"The Auth instance's tenant ID is invalid.","login-blocked":'Login blocked by user-provided method: {$originalMessage}',"missing-android-pkg-name":'An Android Package Name must be provided if the Android App is required to be installed.',"auth-domain-config-required":"Be sure to include authDomain when calling firebase.initializeApp(), by following the instructions in the Firebase console.","missing-app-credential":"The phone verification request is missing an application verifier assertion. A reCAPTCHA response token needs to be provided.","missing-verification-code":'The phone auth credential was created with an empty SMS verification code.',"missing-continue-uri":'A continue URL must be provided in the request.',"missing-iframe-start":'An internal AuthError has occurred.',"missing-ios-bundle-id":'An iOS Bundle ID must be provided if an App Store ID is provided.',"missing-or-invalid-nonce":"The request does not contain a valid nonce. This can occur if the SHA-256 hash of the provided raw nonce does not match the hashed nonce in the ID token payload.","missing-password":'A non-empty password must be provided',"missing-multi-factor-info":'No second factor identifier is provided.',"missing-multi-factor-session":'The request is missing proof of first factor successful sign-in.',"missing-phone-number":'To send verification codes, provide a phone number for the recipient.',"missing-verification-id":'The phone auth credential was created with an empty verification ID.',"app-deleted":'This instance of FirebaseApp has been deleted.',"multi-factor-info-not-found":'The user does not have a second factor matching the identifier provided.',"multi-factor-auth-required":'Proof of ownership of a second factor is required to complete sign-in.',"account-exists-with-different-credential":"An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.","network-request-failed":'A network AuthError (such as timeout, interrupted connection or unreachable host) has occurred.',"no-auth-event":'An internal AuthError has occurred.',"no-such-provider":'User was not linked to an account with the given provider.',"null-user":"A null user object was provided as the argument for an operation which requires a non-null user object.","operation-not-allowed":"The given sign-in provider is disabled for this Firebase project. Enable it in the Firebase console, under the sign-in method tab of the Auth section.","operation-not-supported-in-this-environment":"This operation is not supported in the environment this application is running on. \"location.protocol\" must be http, https or chrome-extension and web storage must be enabled.","popup-blocked":'Unable to establish a connection with the popup. It may have been blocked by the browser.',"popup-closed-by-user":'The popup has been closed by the user before finalizing the operation.',"provider-already-linked":'User can only be linked to one identity for the given provider.',"quota-exceeded":"The project's quota for this operation has been exceeded.","redirect-cancelled-by-user":'The redirect operation has been cancelled by the user before finalizing.',"redirect-operation-pending":'A redirect sign-in operation is already pending.',"rejected-credential":'The request contains malformed or mismatching credentials.',"second-factor-already-in-use":'The second factor is already enrolled on this account.',"maximum-second-factor-count-exceeded":'The maximum allowed number of second factors on a user has been exceeded.',"tenant-id-mismatch":"The provided tenant ID does not match the Auth instance's tenant ID",timeout:'The operation has timed out.',"user-token-expired":"The user's credential is no longer valid. The user must sign in again.","too-many-requests":"We have blocked all requests from this device due to unusual activity. Try again later.","unauthorized-continue-uri":"The domain of the continue URL is not whitelisted.  Please whitelist the domain in the Firebase console.","unsupported-first-factor":'Enrolling a second factor or signing in with a multi-factor account requires sign-in with a supported first factor.',"unsupported-persistence-type":'The current environment does not support the specified persistence type.',"unsupported-tenant-operation":'This operation is not supported in a multi-tenant context.',"unverified-email":'The operation requires a verified email.',"user-cancelled":'The user did not grant your application the permissions it requested.',"user-not-found":"There is no user record corresponding to this identifier. The user may have been deleted.","user-disabled":'The user account has been disabled by an administrator.',"user-mismatch":'The supplied credentials do not correspond to the previously signed in user.',"user-signed-out":'',"weak-password":'The password must be 6 characters long or more.',"web-storage-unsupported":'This browser is not supported or 3rd party cookies and data may be disabled.',"already-initialized":"initializeAuth() has already been called with different options. To avoid this error, call initializeAuth() with the same options as when it was originally called, or call getAuth() to return the already initialized instance.","missing-recaptcha-token":'The reCAPTCHA token is missing when sending request to the backend.',"invalid-recaptcha-token":'The reCAPTCHA token is invalid when sending request to the backend.',"invalid-recaptcha-action":'The reCAPTCHA action is invalid when sending request to the backend.',"recaptcha-not-enabled":'reCAPTCHA Enterprise integration is not enabled for this project.',"missing-client-type":'The reCAPTCHA client type is missing when sending request to the backend.',"missing-recaptcha-version":'The reCAPTCHA version is missing when sending request to the backend.',"invalid-req-type":'Invalid request parameters.',"invalid-recaptcha-version":'The reCAPTCHA version is invalid when sending request to the backend.',"unsupported-password-policy-schema-version":'The password policy received from the backend uses a schema version that is not supported by this version of the Firebase SDK.',"password-does-not-meet-requirements":'The password does not meet the requirements.',"invalid-hosting-link-domain":"The provided Hosting link domain is not configured in Firebase Hosting or is not owned by the current project. This cannot be a default Hosting domain (`web.app` or `firebaseapp.com`)."}},b=E,P=new f.ErrorFactory('auth','Firebase',{"dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK."}),S={ADMIN_ONLY_OPERATION:'auth/admin-restricted-operation',ARGUMENT_ERROR:'auth/argument-error',APP_NOT_AUTHORIZED:'auth/app-not-authorized',APP_NOT_INSTALLED:'auth/app-not-installed',CAPTCHA_CHECK_FAILED:'auth/captcha-check-failed',CODE_EXPIRED:'auth/code-expired',CORDOVA_NOT_READY:'auth/cordova-not-ready',CORS_UNSUPPORTED:'auth/cors-unsupported',CREDENTIAL_ALREADY_IN_USE:'auth/credential-already-in-use',CREDENTIAL_MISMATCH:'auth/custom-token-mismatch',CREDENTIAL_TOO_OLD_LOGIN_AGAIN:'auth/requires-recent-login',DEPENDENT_SDK_INIT_BEFORE_AUTH:'auth/dependent-sdk-initialized-before-auth',DYNAMIC_LINK_NOT_ACTIVATED:'auth/dynamic-link-not-activated',EMAIL_CHANGE_NEEDS_VERIFICATION:'auth/email-change-needs-verification',EMAIL_EXISTS:'auth/email-already-in-use',EMULATOR_CONFIG_FAILED:'auth/emulator-config-failed',EXPIRED_OOB_CODE:'auth/expired-action-code',EXPIRED_POPUP_REQUEST:'auth/cancelled-popup-request',INTERNAL_ERROR:'auth/internal-error',INVALID_API_KEY:'auth/invalid-api-key',INVALID_APP_CREDENTIAL:'auth/invalid-app-credential',INVALID_APP_ID:'auth/invalid-app-id',INVALID_AUTH:'auth/invalid-user-token',INVALID_AUTH_EVENT:'auth/invalid-auth-event',INVALID_CERT_HASH:'auth/invalid-cert-hash',INVALID_CODE:'auth/invalid-verification-code',INVALID_CONTINUE_URI:'auth/invalid-continue-uri',INVALID_CORDOVA_CONFIGURATION:'auth/invalid-cordova-configuration',INVALID_CUSTOM_TOKEN:'auth/invalid-custom-token',INVALID_DYNAMIC_LINK_DOMAIN:'auth/invalid-dynamic-link-domain',INVALID_EMAIL:'auth/invalid-email',INVALID_EMULATOR_SCHEME:'auth/invalid-emulator-scheme',INVALID_IDP_RESPONSE:'auth/invalid-credential',INVALID_LOGIN_CREDENTIALS:'auth/invalid-credential',INVALID_MESSAGE_PAYLOAD:'auth/invalid-message-payload',INVALID_MFA_SESSION:'auth/invalid-multi-factor-session',INVALID_OAUTH_CLIENT_ID:'auth/invalid-oauth-client-id',INVALID_OAUTH_PROVIDER:'auth/invalid-oauth-provider',INVALID_OOB_CODE:'auth/invalid-action-code',INVALID_ORIGIN:'auth/unauthorized-domain',INVALID_PASSWORD:'auth/wrong-password',INVALID_PERSISTENCE:'auth/invalid-persistence-type',INVALID_PHONE_NUMBER:'auth/invalid-phone-number',INVALID_PROVIDER_ID:'auth/invalid-provider-id',INVALID_RECIPIENT_EMAIL:'auth/invalid-recipient-email',INVALID_SENDER:'auth/invalid-sender',INVALID_SESSION_INFO:'auth/invalid-verification-id',INVALID_TENANT_ID:'auth/invalid-tenant-id',MFA_INFO_NOT_FOUND:'auth/multi-factor-info-not-found',MFA_REQUIRED:'auth/multi-factor-auth-required',MISSING_ANDROID_PACKAGE_NAME:'auth/missing-android-pkg-name',MISSING_APP_CREDENTIAL:'auth/missing-app-credential',MISSING_AUTH_DOMAIN:'auth/auth-domain-config-required',MISSING_CODE:'auth/missing-verification-code',MISSING_CONTINUE_URI:'auth/missing-continue-uri',MISSING_IFRAME_START:'auth/missing-iframe-start',MISSING_IOS_BUNDLE_ID:'auth/missing-ios-bundle-id',MISSING_OR_INVALID_NONCE:'auth/missing-or-invalid-nonce',MISSING_MFA_INFO:'auth/missing-multi-factor-info',MISSING_MFA_SESSION:'auth/missing-multi-factor-session',MISSING_PHONE_NUMBER:'auth/missing-phone-number',MISSING_PASSWORD:'auth/missing-password',MISSING_SESSION_INFO:'auth/missing-verification-id',MODULE_DESTROYED:'auth/app-deleted',NEED_CONFIRMATION:'auth/account-exists-with-different-credential',NETWORK_REQUEST_FAILED:'auth/network-request-failed',NULL_USER:'auth/null-user',NO_AUTH_EVENT:'auth/no-auth-event',NO_SUCH_PROVIDER:'auth/no-such-provider',OPERATION_NOT_ALLOWED:'auth/operation-not-allowed',OPERATION_NOT_SUPPORTED:'auth/operation-not-supported-in-this-environment',POPUP_BLOCKED:'auth/popup-blocked',POPUP_CLOSED_BY_USER:'auth/popup-closed-by-user',PROVIDER_ALREADY_LINKED:'auth/provider-already-linked',QUOTA_EXCEEDED:'auth/quota-exceeded',REDIRECT_CANCELLED_BY_USER:'auth/redirect-cancelled-by-user',REDIRECT_OPERATION_PENDING:'auth/redirect-operation-pending',REJECTED_CREDENTIAL:'auth/rejected-credential',SECOND_FACTOR_ALREADY_ENROLLED:'auth/second-factor-already-in-use',SECOND_FACTOR_LIMIT_EXCEEDED:'auth/maximum-second-factor-count-exceeded',TENANT_ID_MISMATCH:'auth/tenant-id-mismatch',TIMEOUT:'auth/timeout',TOKEN_EXPIRED:'auth/user-token-expired',TOO_MANY_ATTEMPTS_TRY_LATER:'auth/too-many-requests',UNAUTHORIZED_DOMAIN:'auth/unauthorized-continue-uri',UNSUPPORTED_FIRST_FACTOR:'auth/unsupported-first-factor',UNSUPPORTED_PERSISTENCE:'auth/unsupported-persistence-type',UNSUPPORTED_TENANT_OPERATION:'auth/unsupported-tenant-operation',UNVERIFIED_EMAIL:'auth/unverified-email',USER_CANCELLED:'auth/user-cancelled',USER_DELETED:'auth/user-not-found',USER_DISABLED:'auth/user-disabled',USER_MISMATCH:'auth/user-mismatch',USER_SIGNED_OUT:'auth/user-signed-out',WEAK_PASSWORD:'auth/weak-password',WEB_STORAGE_UNSUPPORTED:'auth/web-storage-unsupported',ALREADY_INITIALIZED:'auth/already-initialized',RECAPTCHA_NOT_ENABLED:'auth/recaptcha-not-enabled',MISSING_RECAPTCHA_TOKEN:'auth/missing-recaptcha-token',INVALID_RECAPTCHA_TOKEN:'auth/invalid-recaptcha-token',INVALID_RECAPTCHA_ACTION:'auth/invalid-recaptcha-action',MISSING_CLIENT_TYPE:'auth/missing-client-type',MISSING_RECAPTCHA_VERSION:'auth/missing-recaptcha-version',INVALID_RECAPTCHA_VERSION:'auth/invalid-recaptcha-version',INVALID_REQ_TYPE:'auth/invalid-req-type',INVALID_HOSTING_LINK_DOMAIN:'auth/invalid-hosting-link-domain'},A=new m.Logger('@firebase/auth');function O(e,...t){A.logLevel<=m.LogLevel.WARN&&A.warn(`Auth (${p.SDK_VERSION}): ${e}`,...t)}function k(e,...t){A.logLevel<=m.LogLevel.ERROR&&A.error(`Auth (${p.SDK_VERSION}): ${e}`,...t)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function R(e,...t){throw M(e,...t)}function N(e,...t){return M(e,...t)}function C(e,t,n){const r=Object.assign({},b(),{[t]:n});return new f.ErrorFactory('auth','Firebase',r).create(t,{appName:e.name})}function D(e){return C(e,"operation-not-supported-in-this-environment",'Operations that alter the current user are not supported in conjunction with FirebaseServerApp')}function L(e,t,n){if(!(t instanceof n))throw n.name!==t.constructor.name&&R(e,"argument-error"),C(e,"argument-error",`Type of ${t.constructor.name} does not match expected instance.Did you pass a reference from a different Auth SDK?`)}function M(e,...t){if('string'!=typeof e){const n=t[0],r=[...t.slice(1)];return r[0]&&(r[0].appName=e.name),e._errorFactory.create(n,...r)}return P.create(e,...t)}function U(e,t,...n){if(!e)throw M(t,...n)}function j(e){const t="INTERNAL ASSERTION FAILED: "+e;throw k(t),new Error(t)}function F(e,t){e||j(t)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function V(){return'undefined'!=typeof self&&self.location?.href||''}function x(){return'http:'===H()||'https:'===H()}function H(){return'undefined'!=typeof self&&self.location?.protocol||null}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function q(){if('undefined'==typeof navigator)return null;const e=navigator;return e.languages&&e.languages[0]||e.language||null}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class W{constructor(e,t){this.shortDelay=e,this.longDelay=t,F(t>e,'Short delay should be less than long delay!'),this.isMobile=(0,f.isMobileCordova)()||(0,f.isReactNative)()}get(){return'undefined'!=typeof navigator&&navigator&&'onLine'in navigator&&'boolean'==typeof navigator.onLine&&(x()||(0,f.isBrowserExtension)()||'connection'in navigator)&&!navigator.onLine?Math.min(5e3,this.shortDelay):this.isMobile?this.longDelay:this.shortDelay}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function z(e,t){F(e.emulator,'Emulator should always be set here');const{url:n}=e.emulator;return t?`${n}${t.startsWith('/')?t.slice(1):t}`:n}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class G{static initialize(e,t,n){this.fetchImpl=e,t&&(this.headersImpl=t),n&&(this.responseImpl=n)}static fetch(){return this.fetchImpl?this.fetchImpl:'undefined'!=typeof self&&'fetch'in self?self.fetch:'undefined'!=typeof globalThis&&globalThis.fetch?globalThis.fetch:'undefined'!=typeof fetch?fetch:void j('Could not find fetch implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill')}static headers(){return this.headersImpl?this.headersImpl:'undefined'!=typeof self&&'Headers'in self?self.Headers:'undefined'!=typeof globalThis&&globalThis.Headers?globalThis.Headers:'undefined'!=typeof Headers?Headers:void j('Could not find Headers implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill')}static response(){return this.responseImpl?this.responseImpl:'undefined'!=typeof self&&'Response'in self?self.Response:'undefined'!=typeof globalThis&&globalThis.Response?globalThis.Response:'undefined'!=typeof Response?Response:void j('Could not find Response implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill')}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const K={CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_PASSWORD:"wrong-password",MISSING_PASSWORD:"missing-password",INVALID_LOGIN_CREDENTIALS:"invalid-credential",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",INVALID_PENDING_TOKEN:"invalid-credential",FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",MISSING_REQ_TYPE:"internal-error",EMAIL_NOT_FOUND:"user-not-found",RESET_PASSWORD_EXCEED_LIMIT:"too-many-requests",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",PASSWORD_DOES_NOT_MEET_REQUIREMENTS:"password-does-not-meet-requirements",INVALID_CODE:"invalid-verification-code",INVALID_SESSION_INFO:"invalid-verification-id",INVALID_TEMPORARY_PROOF:"invalid-credential",MISSING_SESSION_INFO:"missing-verification-id",SESSION_EXPIRED:"code-expired",MISSING_ANDROID_PACKAGE_NAME:"missing-android-pkg-name",UNAUTHORIZED_DOMAIN:"unauthorized-continue-uri",INVALID_OAUTH_CLIENT_ID:"invalid-oauth-client-id",ADMIN_ONLY_OPERATION:"admin-restricted-operation",INVALID_MFA_PENDING_CREDENTIAL:"invalid-multi-factor-session",MFA_ENROLLMENT_NOT_FOUND:"multi-factor-info-not-found",MISSING_MFA_ENROLLMENT_ID:"missing-multi-factor-info",MISSING_MFA_PENDING_CREDENTIAL:"missing-multi-factor-session",SECOND_FACTOR_EXISTS:"second-factor-already-in-use",SECOND_FACTOR_LIMIT_EXCEEDED:"maximum-second-factor-count-exceeded",BLOCKING_FUNCTION_ERROR_RESPONSE:"internal-error",RECAPTCHA_NOT_ENABLED:"recaptcha-not-enabled",MISSING_RECAPTCHA_TOKEN:"missing-recaptcha-token",INVALID_RECAPTCHA_TOKEN:"invalid-recaptcha-token",INVALID_RECAPTCHA_ACTION:"invalid-recaptcha-action",MISSING_CLIENT_TYPE:"missing-client-type",MISSING_RECAPTCHA_VERSION:"missing-recaptcha-version",INVALID_RECAPTCHA_VERSION:"invalid-recaptcha-version",INVALID_REQ_TYPE:"invalid-req-type"},$=["/v1/accounts:signInWithCustomToken","/v1/accounts:signInWithEmailLink","/v1/accounts:signInWithIdp","/v1/accounts:signInWithPassword","/v1/accounts:signInWithPhoneNumber","/v1/token"],B=new W(3e4,6e4);
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function J(e,t){return e.tenantId&&!t.tenantId?Object.assign({},t,{tenantId:e.tenantId}):t}async function Y(e,t,n,r,i={}){return X(e,i,async()=>{let i={},s={};r&&("GET"===t?s=r:i={body:JSON.stringify(r)});const a=(0,f.querystring)(Object.assign({key:e.config.apiKey},s)).slice(1),o=await e._getAdditionalHeaders();o["Content-Type"]='application/json',e.languageCode&&(o["X-Firebase-Locale"]=e.languageCode);const c=Object.assign({method:t,headers:o},i);return(0,f.isCloudflareWorker)()||(c.referrerPolicy='no-referrer'),e.emulatorConfig&&(0,f.isCloudWorkstation)(e.emulatorConfig.host)&&(c.credentials='include'),G.fetch()(await Z(e,e.config.apiHost,n,a),c)})}async function X(e,t,n){e._canInitEmulator=!1;const r=Object.assign({},K,t);try{const t=new te(e),i=await Promise.race([n(),t.promise]);t.clearNetworkTimeout();const s=await i.json();if('needConfirmation'in s)throw ne(e,"account-exists-with-different-credential",s);if(i.ok&&!('errorMessage'in s))return s;{const t=i.ok?s.errorMessage:s.error.message,[n,a]=t.split(' : ');if("FEDERATED_USER_ID_ALREADY_LINKED"===n)throw ne(e,"credential-already-in-use",s);if("EMAIL_EXISTS"===n)throw ne(e,"email-already-in-use",s);if("USER_DISABLED"===n)throw ne(e,"user-disabled",s);const o=r[n]||n.toLowerCase().replace(/[_\s]+/g,'-');if(a)throw C(e,o,a);R(e,o)}}catch(t){if(t instanceof f.FirebaseError)throw t;R(e,"network-request-failed",{message:String(t)})}}async function Q(e,t,n,r,i={}){const s=await Y(e,t,n,r,i);return'mfaPendingCredential'in s&&R(e,"multi-factor-auth-required",{_serverResponse:s}),s}async function Z(e,t,n,r){const i=`${t}${n}?${r}`,s=e,a=s.config.emulator?z(e.config,i):`${e.config.apiScheme}://${i}`;if($.includes(n)&&(await s._persistenceManagerAvailable,"COOKIE"===s._getPersistenceType())){return s._getPersistence()._getFinalTarget(a).toString()}return a}function ee(e){switch(e){case'ENFORCE':return"ENFORCE";case'AUDIT':return"AUDIT";case'OFF':return"OFF";default:return"ENFORCEMENT_STATE_UNSPECIFIED"}}class te{clearNetworkTimeout(){clearTimeout(this.timer)}constructor(e){this.auth=e,this.timer=null,this.promise=new Promise((e,t)=>{this.timer=setTimeout(()=>t(N(this.auth,"network-request-failed")),B.get())})}}function ne(e,t,n){const r={appName:e.name};n.email&&(r.email=n.email),n.phoneNumber&&(r.phoneNumber=n.phoneNumber);const i=N(e,t,r);return i.customData._tokenResponse=n,i}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function re(e){return void 0!==e&&void 0!==e.getResponse}function ie(e){return void 0!==e&&void 0!==e.enterprise}class se{constructor(e){if(this.siteKey='',this.recaptchaEnforcementState=[],void 0===e.recaptchaKey)throw new Error('recaptchaKey undefined');this.siteKey=e.recaptchaKey.split('/')[3],this.recaptchaEnforcementState=e.recaptchaEnforcementState}getProviderEnforcementState(e){if(!this.recaptchaEnforcementState||0===this.recaptchaEnforcementState.length)return null;for(const t of this.recaptchaEnforcementState)if(t.provider&&t.provider===e)return ee(t.enforcementState);return null}isProviderEnabled(e){return"ENFORCE"===this.getProviderEnforcementState(e)||"AUDIT"===this.getProviderEnforcementState(e)}isAnyProviderEnabled(){return this.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")||this.isProviderEnabled("PHONE_PROVIDER")}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function ae(e){return(await Y(e,"GET","/v1/recaptchaParams")).recaptchaSiteKey||''}async function oe(e,t){return Y(e,"GET","/v2/recaptchaConfig",J(e,t))}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function ce(e,t){return Y(e,"POST","/v1/accounts:delete",t)}async function ue(e,t){return Y(e,"POST","/v1/accounts:update",t)}async function de(e,t){return Y(e,"POST","/v1/accounts:lookup",t)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function le(e){if(e)try{const t=new Date(Number(e));if(!isNaN(t.getTime()))return t.toUTCString()}catch(e){}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function he(e,t=!1){return(0,f.getModularInstance)(e).getIdToken(t)}async function pe(e,t=!1){const n=(0,f.getModularInstance)(e),r=await n.getIdToken(t),i=me(r);U(i&&i.exp&&i.auth_time&&i.iat,n.auth,"internal-error");const s='object'==typeof i.firebase?i.firebase:void 0,a=s?.sign_in_provider;return{claims:i,token:r,authTime:le(fe(i.auth_time)),issuedAtTime:le(fe(i.iat)),expirationTime:le(fe(i.exp)),signInProvider:a||null,signInSecondFactor:s?.sign_in_second_factor||null}}function fe(e){return 1e3*Number(e)}function me(e){const[t,n,r]=e.split('.');if(void 0===t||void 0===n||void 0===r)return k('JWT malformed, contained fewer than 3 sections'),null;try{const e=(0,f.base64Decode)(n);return e?JSON.parse(e):(k('Failed to decode base64 JWT payload'),null)}catch(e){return k('Caught error parsing JWT payload as JSON',e?.toString()),null}}function ge(e){const t=me(e);return U(t,"internal-error"),U(void 0!==t.exp,"internal-error"),U(void 0!==t.iat,"internal-error"),Number(t.exp)-Number(t.iat)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Ie(e,t,n=!1){if(n)return t;try{return await t}catch(t){throw t instanceof f.FirebaseError&&_e(t)&&e.auth.currentUser===e&&await e.auth.signOut(),t}}function _e({code:e}){return"auth/user-disabled"===e||"auth/user-token-expired"===e}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class ye{constructor(e){this.user=e,this.isRunning=!1,this.timerId=null,this.errorBackoff=3e4}_start(){this.isRunning||(this.isRunning=!0,this.schedule())}_stop(){this.isRunning&&(this.isRunning=!1,null!==this.timerId&&clearTimeout(this.timerId))}getInterval(e){if(e){const e=this.errorBackoff;return this.errorBackoff=Math.min(2*this.errorBackoff,96e4),e}{this.errorBackoff=3e4;const e=(this.user.stsTokenManager.expirationTime??0)-Date.now()-3e5;return Math.max(0,e)}}schedule(e=!1){if(!this.isRunning)return;const t=this.getInterval(e);this.timerId=setTimeout(async()=>{await this.iteration()},t)}async iteration(){try{await this.user.getIdToken(!0)}catch(e){return void("auth/network-request-failed"===e?.code&&this.schedule(!0))}this.schedule()}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class ve{constructor(e,t){this.createdAt=e,this.lastLoginAt=t,this._initializeTime()}_initializeTime(){this.lastSignInTime=le(this.lastLoginAt),this.creationTime=le(this.createdAt)}_copy(e){this.createdAt=e.createdAt,this.lastLoginAt=e.lastLoginAt,this._initializeTime()}toJSON(){return{createdAt:this.createdAt,lastLoginAt:this.lastLoginAt}}}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Te(e){const t=e.auth,n=await e.getIdToken(),r=await Ie(e,de(t,{idToken:n}));U(r?.users.length,t,"internal-error");const i=r.users[0];e._notifyReloadListener(i);const s=i.providerUserInfo?.length?be(i.providerUserInfo):[],a=we(e.providerData,s),o=e.isAnonymous,c=!(e.email&&i.passwordHash||a?.length),u=!!o&&c,d={uid:i.localId,displayName:i.displayName||null,photoURL:i.photoUrl||null,email:i.email||null,emailVerified:i.emailVerified||!1,phoneNumber:i.phoneNumber||null,tenantId:i.tenantId||null,providerData:a,metadata:new ve(i.createdAt,i.lastLoginAt),isAnonymous:u};Object.assign(e,d)}async function Ee(e){const t=(0,f.getModularInstance)(e);await Te(t),await t.auth._persistUserIfCurrent(t),t.auth._notifyListenersIfCurrent(t)}function we(e,t){return[...e.filter(e=>!t.some(t=>t.providerId===e.providerId)),...t]}function be(e){return e.map(e=>{let{providerId:t}=e,n=(0,h.default)(e,o);return{providerId:t,uid:n.rawId||'',displayName:n.displayName||null,email:n.email||null,phoneNumber:n.phoneNumber||null,photoURL:n.photoUrl||null}})}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Pe(e,t){const n=await X(e,{},async()=>{const n=(0,f.querystring)({grant_type:'refresh_token',refresh_token:t}).slice(1),{tokenApiHost:r,apiKey:i}=e.config,s=await Z(e,r,"/v1/token",`key=${i}`),a=await e._getAdditionalHeaders();a["Content-Type"]='application/x-www-form-urlencoded';const o={method:"POST",headers:a,body:n};return e.emulatorConfig&&(0,f.isCloudWorkstation)(e.emulatorConfig.host)&&(o.credentials='include'),G.fetch()(s,o)});return{accessToken:n.access_token,expiresIn:n.expires_in,refreshToken:n.refresh_token}}async function Se(e,t){return Y(e,"POST","/v2/accounts:revokeToken",J(e,t))}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Ae{constructor(){this.refreshToken=null,this.accessToken=null,this.expirationTime=null}get isExpired(){return!this.expirationTime||Date.now()>this.expirationTime-3e4}updateFromServerResponse(e){U(e.idToken,"internal-error"),U(void 0!==e.idToken,"internal-error"),U(void 0!==e.refreshToken,"internal-error");const t='expiresIn'in e&&void 0!==e.expiresIn?Number(e.expiresIn):ge(e.idToken);this.updateTokensAndExpiration(e.idToken,e.refreshToken,t)}updateFromIdToken(e){U(0!==e.length,"internal-error");const t=ge(e);this.updateTokensAndExpiration(e,null,t)}async getToken(e,t=!1){return t||!this.accessToken||this.isExpired?(U(this.refreshToken,e,"user-token-expired"),this.refreshToken?(await this.refresh(e,this.refreshToken),this.accessToken):null):this.accessToken}clearRefreshToken(){this.refreshToken=null}async refresh(e,t){const{accessToken:n,refreshToken:r,expiresIn:i}=await Pe(e,t);this.updateTokensAndExpiration(n,r,Number(i))}updateTokensAndExpiration(e,t,n){this.refreshToken=t||null,this.accessToken=e||null,this.expirationTime=Date.now()+1e3*n}static fromJSON(e,t){const{refreshToken:n,accessToken:r,expirationTime:i}=t,s=new Ae;return n&&(U('string'==typeof n,"internal-error",{appName:e}),s.refreshToken=n),r&&(U('string'==typeof r,"internal-error",{appName:e}),s.accessToken=r),i&&(U('number'==typeof i,"internal-error",{appName:e}),s.expirationTime=i),s}toJSON(){return{refreshToken:this.refreshToken,accessToken:this.accessToken,expirationTime:this.expirationTime}}_assign(e){this.accessToken=e.accessToken,this.refreshToken=e.refreshToken,this.expirationTime=e.expirationTime}_clone(){return Object.assign(new Ae,this.toJSON())}_performRefresh(){return j('not implemented')}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Oe(e,t){U('string'==typeof e||void 0===e,"internal-error",{appName:t})}class ke{constructor(e){let{uid:t,auth:n,stsTokenManager:r}=e,i=(0,h.default)(e,c);this.providerId="firebase",this.proactiveRefresh=new ye(this),this.reloadUserInfo=null,this.reloadListener=null,this.uid=t,this.auth=n,this.stsTokenManager=r,this.accessToken=r.accessToken,this.displayName=i.displayName||null,this.email=i.email||null,this.emailVerified=i.emailVerified||!1,this.phoneNumber=i.phoneNumber||null,this.photoURL=i.photoURL||null,this.isAnonymous=i.isAnonymous||!1,this.tenantId=i.tenantId||null,this.providerData=i.providerData?[...i.providerData]:[],this.metadata=new ve(i.createdAt||void 0,i.lastLoginAt||void 0)}async getIdToken(e){const t=await Ie(this,this.stsTokenManager.getToken(this.auth,e));return U(t,this.auth,"internal-error"),this.accessToken!==t&&(this.accessToken=t,await this.auth._persistUserIfCurrent(this),this.auth._notifyListenersIfCurrent(this)),t}getIdTokenResult(e){return pe(this,e)}reload(){return Ee(this)}_assign(e){this!==e&&(U(this.uid===e.uid,this.auth,"internal-error"),this.displayName=e.displayName,this.photoURL=e.photoURL,this.email=e.email,this.emailVerified=e.emailVerified,this.phoneNumber=e.phoneNumber,this.isAnonymous=e.isAnonymous,this.tenantId=e.tenantId,this.providerData=e.providerData.map(e=>Object.assign({},e)),this.metadata._copy(e.metadata),this.stsTokenManager._assign(e.stsTokenManager))}_clone(e){const t=new ke(Object.assign({},this,{auth:e,stsTokenManager:this.stsTokenManager._clone()}));return t.metadata._copy(this.metadata),t}_onReload(e){U(!this.reloadListener,this.auth,"internal-error"),this.reloadListener=e,this.reloadUserInfo&&(this._notifyReloadListener(this.reloadUserInfo),this.reloadUserInfo=null)}_notifyReloadListener(e){this.reloadListener?this.reloadListener(e):this.reloadUserInfo=e}_startProactiveRefresh(){this.proactiveRefresh._start()}_stopProactiveRefresh(){this.proactiveRefresh._stop()}async _updateTokensIfNecessary(e,t=!1){let n=!1;e.idToken&&e.idToken!==this.stsTokenManager.accessToken&&(this.stsTokenManager.updateFromServerResponse(e),n=!0),t&&await Te(this),await this.auth._persistUserIfCurrent(this),n&&this.auth._notifyListenersIfCurrent(this)}async delete(){if((0,p._isFirebaseServerApp)(this.auth.app))return Promise.reject(D(this.auth));const e=await this.getIdToken();return await Ie(this,ce(this.auth,{idToken:e})),this.stsTokenManager.clearRefreshToken(),this.auth.signOut()}toJSON(){return Object.assign({uid:this.uid,email:this.email||void 0,emailVerified:this.emailVerified,displayName:this.displayName||void 0,isAnonymous:this.isAnonymous,photoURL:this.photoURL||void 0,phoneNumber:this.phoneNumber||void 0,tenantId:this.tenantId||void 0,providerData:this.providerData.map(e=>Object.assign({},e)),stsTokenManager:this.stsTokenManager.toJSON(),_redirectEventId:this._redirectEventId},this.metadata.toJSON(),{apiKey:this.auth.config.apiKey,appName:this.auth.name})}get refreshToken(){return this.stsTokenManager.refreshToken||''}static _fromJSON(e,t){const n=t.displayName??void 0,r=t.email??void 0,i=t.phoneNumber??void 0,s=t.photoURL??void 0,a=t.tenantId??void 0,o=t._redirectEventId??void 0,c=t.createdAt??void 0,u=t.lastLoginAt??void 0,{uid:d,emailVerified:l,isAnonymous:h,providerData:p,stsTokenManager:f}=t;U(d&&f,e,"internal-error");const m=Ae.fromJSON(this.name,f);U('string'==typeof d,e,"internal-error"),Oe(n,e.name),Oe(r,e.name),U('boolean'==typeof l,e,"internal-error"),U('boolean'==typeof h,e,"internal-error"),Oe(i,e.name),Oe(s,e.name),Oe(a,e.name),Oe(o,e.name),Oe(c,e.name),Oe(u,e.name);const g=new ke({uid:d,auth:e,email:r,emailVerified:l,displayName:n,isAnonymous:h,photoURL:s,phoneNumber:i,tenantId:a,stsTokenManager:m,createdAt:c,lastLoginAt:u});return p&&Array.isArray(p)&&(g.providerData=p.map(e=>Object.assign({},e))),o&&(g._redirectEventId=o),g}static async _fromIdTokenResponse(e,t,n=!1){const r=new Ae;r.updateFromServerResponse(t);const i=new ke({uid:t.localId,auth:e,stsTokenManager:r,isAnonymous:n});return await Te(i),i}static async _fromGetAccountInfoResponse(e,t,n){const r=t.users[0];U(void 0!==r.localId,"internal-error");const i=void 0!==r.providerUserInfo?be(r.providerUserInfo):[],s=!(r.email&&r.passwordHash||i?.length),a=new Ae;a.updateFromIdToken(n);const o=new ke({uid:r.localId,auth:e,stsTokenManager:a,isAnonymous:s}),c={uid:r.localId,displayName:r.displayName||null,photoURL:r.photoUrl||null,email:r.email||null,emailVerified:r.emailVerified||!1,phoneNumber:r.phoneNumber||null,tenantId:r.tenantId||null,providerData:i,metadata:new ve(r.createdAt,r.lastLoginAt),isAnonymous:!(r.email&&r.passwordHash||i?.length)};return Object.assign(o,c),o}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const Re=new Map;function Ne(e){F(e instanceof Function,'Expected a class definition');let t=Re.get(e);return t?(F(t instanceof e,'Instance stored in cache mismatched with class'),t):(t=new e,Re.set(e,t),t)}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Ce{constructor(){this.type="NONE",this.storage={}}async _isAvailable(){return!0}async _set(e,t){this.storage[e]=t}async _get(e){const t=this.storage[e];return void 0===t?null:t}async _remove(e){delete this.storage[e]}_addListener(e,t){}_removeListener(e,t){}}Ce.type='NONE';const De=Ce;
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Le(e,t,n){return`firebase:${e}:${t}:${n}`}class Me{constructor(e,t,n){this.persistence=e,this.auth=t,this.userKey=n;const{config:r,name:i}=this.auth;this.fullUserKey=Le(this.userKey,r.apiKey,i),this.fullPersistenceKey=Le("persistence",r.apiKey,i),this.boundEventHandler=t._onStorageEvent.bind(t),this.persistence._addListener(this.fullUserKey,this.boundEventHandler)}setCurrentUser(e){return this.persistence._set(this.fullUserKey,e.toJSON())}async getCurrentUser(){const e=await this.persistence._get(this.fullUserKey);if(!e)return null;if('string'==typeof e){const t=await de(this.auth,{idToken:e}).catch(()=>{});return t?ke._fromGetAccountInfoResponse(this.auth,t,e):null}return ke._fromJSON(this.auth,e)}removeCurrentUser(){return this.persistence._remove(this.fullUserKey)}savePersistenceForRedirect(){return this.persistence._set(this.fullPersistenceKey,this.persistence.type)}async setPersistence(e){if(this.persistence===e)return;const t=await this.getCurrentUser();return await this.removeCurrentUser(),this.persistence=e,t?this.setCurrentUser(t):void 0}delete(){this.persistence._removeListener(this.fullUserKey,this.boundEventHandler)}static async create(e,t,n="authUser"){if(!t.length)return new Me(Ne(De),e,n);const r=(await Promise.all(t.map(async e=>{if(await e._isAvailable())return e}))).filter(e=>e);let i=r[0]||Ne(De);const s=Le(n,e.config.apiKey,e.name);let a=null;for(const n of t)try{const t=await n._get(s);if(t){let r;if('string'==typeof t){const n=await de(e,{idToken:t}).catch(()=>{});if(!n)break;r=await ke._fromGetAccountInfoResponse(e,n,t)}else r=ke._fromJSON(e,t);n!==i&&(a=r),i=n;break}}catch{}const o=r.filter(e=>e._shouldAllowMigration);return i._shouldAllowMigration&&o.length?(i=o[0],a&&await i._set(s,a.toJSON()),await Promise.all(t.map(async e=>{if(e!==i)try{await e._remove(s)}catch{}})),new Me(i,e,n)):new Me(i,e,n)}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Ue(e){const t=e.toLowerCase();if(t.includes('opera/')||t.includes('opr/')||t.includes('opios/'))return"Opera";if(xe(t))return"IEMobile";if(t.includes('msie')||t.includes('trident/'))return"IE";if(t.includes('edge/'))return"Edge";if(je(t))return"Firefox";if(t.includes('silk/'))return"Silk";if(qe(t))return"Blackberry";if(We(t))return"Webos";if(Fe(t))return"Safari";if((t.includes('chrome/')||Ve(t))&&!t.includes('edge/'))return"Chrome";if(He(t))return"Android";{const t=/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/,n=e.match(t);if(2===n?.length)return n[1]}return"Other"}function je(e=(0,f.getUA)()){return/firefox\//i.test(e)}function Fe(e=(0,f.getUA)()){const t=e.toLowerCase();return t.includes('safari/')&&!t.includes('chrome/')&&!t.includes('crios/')&&!t.includes('android')}function Ve(e=(0,f.getUA)()){return/crios\//i.test(e)}function xe(e=(0,f.getUA)()){return/iemobile/i.test(e)}function He(e=(0,f.getUA)()){return/android/i.test(e)}function qe(e=(0,f.getUA)()){return/blackberry/i.test(e)}function We(e=(0,f.getUA)()){return/webos/i.test(e)}function ze(e=(0,f.getUA)()){return/iphone|ipad|ipod/i.test(e)||/macintosh/i.test(e)&&/mobile/i.test(e)}function Ge(e=(0,f.getUA)()){return/(iPad|iPhone|iPod).*OS 7_\d/i.test(e)||/(iPad|iPhone|iPod).*OS 8_\d/i.test(e)}function Ke(e=(0,f.getUA)()){return ze(e)&&!!window.navigator?.standalone}function $e(e=(0,f.getUA)()){return ze(e)||He(e)||We(e)||qe(e)||/windows phone/i.test(e)||xe(e)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Be(e,t=[]){let n;switch(e){case"Browser":n=Ue((0,f.getUA)());break;case"Worker":n=`${Ue((0,f.getUA)())}-${e}`;break;default:n=e}const r=t.length?t.join(','):'FirebaseCore-web';return`${n}/JsCore/${p.SDK_VERSION}/${r}`}
/**
   * @license
   * Copyright 2022 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Je{constructor(e){this.auth=e,this.queue=[]}pushCallback(e,t){const n=t=>new Promise((n,r)=>{try{n(e(t))}catch(e){r(e)}});n.onAbort=t,this.queue.push(n);const r=this.queue.length-1;return()=>{this.queue[r]=()=>Promise.resolve()}}async runMiddleware(e){if(this.auth.currentUser===e)return;const t=[];try{for(const n of this.queue)await n(e),n.onAbort&&t.push(n.onAbort)}catch(e){t.reverse();for(const e of t)try{e()}catch(e){}throw this.auth._errorFactory.create("login-blocked",{originalMessage:e?.message})}}}
/**
   * @license
   * Copyright 2023 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Ye(e,t={}){return Y(e,"GET","/v2/passwordPolicy",J(e,t))}
/**
   * @license
   * Copyright 2023 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Xe{constructor(e){const t=e.customStrengthOptions;this.customStrengthOptions={},this.customStrengthOptions.minPasswordLength=t.minPasswordLength??6,t.maxPasswordLength&&(this.customStrengthOptions.maxPasswordLength=t.maxPasswordLength),void 0!==t.containsLowercaseCharacter&&(this.customStrengthOptions.containsLowercaseLetter=t.containsLowercaseCharacter),void 0!==t.containsUppercaseCharacter&&(this.customStrengthOptions.containsUppercaseLetter=t.containsUppercaseCharacter),void 0!==t.containsNumericCharacter&&(this.customStrengthOptions.containsNumericCharacter=t.containsNumericCharacter),void 0!==t.containsNonAlphanumericCharacter&&(this.customStrengthOptions.containsNonAlphanumericCharacter=t.containsNonAlphanumericCharacter),this.enforcementState=e.enforcementState,'ENFORCEMENT_STATE_UNSPECIFIED'===this.enforcementState&&(this.enforcementState='OFF'),this.allowedNonAlphanumericCharacters=e.allowedNonAlphanumericCharacters?.join('')??'',this.forceUpgradeOnSignin=e.forceUpgradeOnSignin??!1,this.schemaVersion=e.schemaVersion}validatePassword(e){const t={isValid:!0,passwordPolicy:this};return this.validatePasswordLengthOptions(e,t),this.validatePasswordCharacterOptions(e,t),t.isValid&&(t.isValid=t.meetsMinPasswordLength??!0),t.isValid&&(t.isValid=t.meetsMaxPasswordLength??!0),t.isValid&&(t.isValid=t.containsLowercaseLetter??!0),t.isValid&&(t.isValid=t.containsUppercaseLetter??!0),t.isValid&&(t.isValid=t.containsNumericCharacter??!0),t.isValid&&(t.isValid=t.containsNonAlphanumericCharacter??!0),t}validatePasswordLengthOptions(e,t){const n=this.customStrengthOptions.minPasswordLength,r=this.customStrengthOptions.maxPasswordLength;n&&(t.meetsMinPasswordLength=e.length>=n),r&&(t.meetsMaxPasswordLength=e.length<=r)}validatePasswordCharacterOptions(e,t){let n;this.updatePasswordCharacterOptionsStatuses(t,!1,!1,!1,!1);for(let r=0;r<e.length;r++)n=e.charAt(r),this.updatePasswordCharacterOptionsStatuses(t,n>='a'&&n<='z',n>='A'&&n<='Z',n>='0'&&n<='9',this.allowedNonAlphanumericCharacters.includes(n))}updatePasswordCharacterOptionsStatuses(e,t,n,r,i){this.customStrengthOptions.containsLowercaseLetter&&(e.containsLowercaseLetter||(e.containsLowercaseLetter=t)),this.customStrengthOptions.containsUppercaseLetter&&(e.containsUppercaseLetter||(e.containsUppercaseLetter=n)),this.customStrengthOptions.containsNumericCharacter&&(e.containsNumericCharacter||(e.containsNumericCharacter=r)),this.customStrengthOptions.containsNonAlphanumericCharacter&&(e.containsNonAlphanumericCharacter||(e.containsNonAlphanumericCharacter=i))}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Qe{constructor(e,t,n,r){this.app=e,this.heartbeatServiceProvider=t,this.appCheckServiceProvider=n,this.config=r,this.currentUser=null,this.emulatorConfig=null,this.operations=Promise.resolve(),this.authStateSubscription=new et(this),this.idTokenSubscription=new et(this),this.beforeStateQueue=new Je(this),this.redirectUser=null,this.isProactiveRefreshEnabled=!1,this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION=1,this._canInitEmulator=!0,this._isInitialized=!1,this._deleted=!1,this._initializationPromise=null,this._popupRedirectResolver=null,this._errorFactory=P,this._agentRecaptchaConfig=null,this._tenantRecaptchaConfigs={},this._projectPasswordPolicy=null,this._tenantPasswordPolicies={},this._resolvePersistenceManagerAvailable=void 0,this.lastNotifiedUid=void 0,this.languageCode=null,this.tenantId=null,this.settings={appVerificationDisabledForTesting:!1},this.frameworks=[],this.name=e.name,this.clientVersion=r.sdkClientVersion,this._persistenceManagerAvailable=new Promise(e=>this._resolvePersistenceManagerAvailable=e)}_initializeWithPersistence(e,t){return t&&(this._popupRedirectResolver=Ne(t)),this._initializationPromise=this.queue(async()=>{if(!this._deleted&&(this.persistenceManager=await Me.create(this,e),this._resolvePersistenceManagerAvailable?.(),!this._deleted)){if(this._popupRedirectResolver?._shouldInitProactively)try{await this._popupRedirectResolver._initialize(this)}catch(e){}await this.initializeCurrentUser(t),this.lastNotifiedUid=this.currentUser?.uid||null,this._deleted||(this._isInitialized=!0)}}),this._initializationPromise}async _onStorageEvent(){if(this._deleted)return;const e=await this.assertedPersistence.getCurrentUser();return this.currentUser||e?this.currentUser&&e&&this.currentUser.uid===e.uid?(this._currentUser._assign(e),void await this.currentUser.getIdToken()):void await this._updateCurrentUser(e,!0):void 0}async initializeCurrentUserFromIdToken(e){try{const t=await de(this,{idToken:e}),n=await ke._fromGetAccountInfoResponse(this,t,e);await this.directlySetCurrentUser(n)}catch(e){await this.directlySetCurrentUser(null)}}async initializeCurrentUser(e){if((0,p._isFirebaseServerApp)(this.app)){const e=this.app.settings.authIdToken;return e?new Promise(t=>{setTimeout(()=>this.initializeCurrentUserFromIdToken(e).then(t,t))}):this.directlySetCurrentUser(null)}const t=await this.assertedPersistence.getCurrentUser();let n=t,r=!1;if(e&&this.config.authDomain){await this.getOrInitRedirectPersistenceManager();const t=this.redirectUser?._redirectEventId,i=n?._redirectEventId,s=await this.tryRedirectSignIn(e);t&&t!==i||!s?.user||(n=s.user,r=!0)}if(!n)return this.directlySetCurrentUser(null);if(!n._redirectEventId){if(r)try{await this.beforeStateQueue.runMiddleware(n)}catch(e){n=t,this._popupRedirectResolver._overrideRedirectResult(this,()=>Promise.reject(e))}return n?this.reloadAndSetCurrentUserOrClear(n):this.directlySetCurrentUser(null)}return U(this._popupRedirectResolver,this,"argument-error"),await this.getOrInitRedirectPersistenceManager(),this.redirectUser&&this.redirectUser._redirectEventId===n._redirectEventId?this.directlySetCurrentUser(n):this.reloadAndSetCurrentUserOrClear(n)}async tryRedirectSignIn(e){let t=null;try{t=await this._popupRedirectResolver._completeRedirectFn(this,e,!0)}catch(e){await this._setRedirectUser(null)}return t}async reloadAndSetCurrentUserOrClear(e){try{await Te(e)}catch(e){if("auth/network-request-failed"!==e?.code)return this.directlySetCurrentUser(null)}return this.directlySetCurrentUser(e)}useDeviceLanguage(){this.languageCode=q()}async _delete(){this._deleted=!0}async updateCurrentUser(e){if((0,p._isFirebaseServerApp)(this.app))return Promise.reject(D(this));const t=e?(0,f.getModularInstance)(e):null;return t&&U(t.auth.config.apiKey===this.config.apiKey,this,"invalid-user-token"),this._updateCurrentUser(t&&t._clone(this))}async _updateCurrentUser(e,t=!1){if(!this._deleted)return e&&U(this.tenantId===e.tenantId,this,"tenant-id-mismatch"),t||await this.beforeStateQueue.runMiddleware(e),this.queue(async()=>{await this.directlySetCurrentUser(e),this.notifyAuthListeners()})}async signOut(){return(0,p._isFirebaseServerApp)(this.app)?Promise.reject(D(this)):(await this.beforeStateQueue.runMiddleware(null),(this.redirectPersistenceManager||this._popupRedirectResolver)&&await this._setRedirectUser(null),this._updateCurrentUser(null,!0))}setPersistence(e){return(0,p._isFirebaseServerApp)(this.app)?Promise.reject(D(this)):this.queue(async()=>{await this.assertedPersistence.setPersistence(Ne(e))})}_getRecaptchaConfig(){return null==this.tenantId?this._agentRecaptchaConfig:this._tenantRecaptchaConfigs[this.tenantId]}async validatePassword(e){this._getPasswordPolicyInternal()||await this._updatePasswordPolicy();const t=this._getPasswordPolicyInternal();return t.schemaVersion!==this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION?Promise.reject(this._errorFactory.create("unsupported-password-policy-schema-version",{})):t.validatePassword(e)}_getPasswordPolicyInternal(){return null===this.tenantId?this._projectPasswordPolicy:this._tenantPasswordPolicies[this.tenantId]}async _updatePasswordPolicy(){const e=await Ye(this),t=new Xe(e);null===this.tenantId?this._projectPasswordPolicy=t:this._tenantPasswordPolicies[this.tenantId]=t}_getPersistenceType(){return this.assertedPersistence.persistence.type}_getPersistence(){return this.assertedPersistence.persistence}_updateErrorMap(e){this._errorFactory=new f.ErrorFactory('auth','Firebase',e())}onAuthStateChanged(e,t,n){return this.registerStateListener(this.authStateSubscription,e,t,n)}beforeAuthStateChanged(e,t){return this.beforeStateQueue.pushCallback(e,t)}onIdTokenChanged(e,t,n){return this.registerStateListener(this.idTokenSubscription,e,t,n)}authStateReady(){return new Promise((e,t)=>{if(this.currentUser)e();else{const n=this.onAuthStateChanged(()=>{n(),e()},t)}})}async revokeAccessToken(e){if(this.currentUser){const t={providerId:'apple.com',tokenType:"ACCESS_TOKEN",token:e,idToken:await this.currentUser.getIdToken()};null!=this.tenantId&&(t.tenantId=this.tenantId),await Se(this,t)}}toJSON(){return{apiKey:this.config.apiKey,authDomain:this.config.authDomain,appName:this.name,currentUser:this._currentUser?.toJSON()}}async _setRedirectUser(e,t){const n=await this.getOrInitRedirectPersistenceManager(t);return null===e?n.removeCurrentUser():n.setCurrentUser(e)}async getOrInitRedirectPersistenceManager(e){if(!this.redirectPersistenceManager){const t=e&&Ne(e)||this._popupRedirectResolver;U(t,this,"argument-error"),this.redirectPersistenceManager=await Me.create(this,[Ne(t._redirectPersistence)],"redirectUser"),this.redirectUser=await this.redirectPersistenceManager.getCurrentUser()}return this.redirectPersistenceManager}async _redirectUserForId(e){return this._isInitialized&&await this.queue(async()=>{}),this._currentUser?._redirectEventId===e?this._currentUser:this.redirectUser?._redirectEventId===e?this.redirectUser:null}async _persistUserIfCurrent(e){if(e===this.currentUser)return this.queue(async()=>this.directlySetCurrentUser(e))}_notifyListenersIfCurrent(e){e===this.currentUser&&this.notifyAuthListeners()}_key(){return`${this.config.authDomain}:${this.config.apiKey}:${this.name}`}_startProactiveRefresh(){this.isProactiveRefreshEnabled=!0,this.currentUser&&this._currentUser._startProactiveRefresh()}_stopProactiveRefresh(){this.isProactiveRefreshEnabled=!1,this.currentUser&&this._currentUser._stopProactiveRefresh()}get _currentUser(){return this.currentUser}notifyAuthListeners(){if(!this._isInitialized)return;this.idTokenSubscription.next(this.currentUser);const e=this.currentUser?.uid??null;this.lastNotifiedUid!==e&&(this.lastNotifiedUid=e,this.authStateSubscription.next(this.currentUser))}registerStateListener(e,t,n,r){if(this._deleted)return()=>{};const i='function'==typeof t?t:t.next.bind(t);let s=!1;const a=this._isInitialized?Promise.resolve():this._initializationPromise;if(U(a,this,"internal-error"),a.then(()=>{s||i(this.currentUser)}),'function'==typeof t){const i=e.addObserver(t,n,r);return()=>{s=!0,i()}}{const n=e.addObserver(t);return()=>{s=!0,n()}}}async directlySetCurrentUser(e){this.currentUser&&this.currentUser!==e&&this._currentUser._stopProactiveRefresh(),e&&this.isProactiveRefreshEnabled&&e._startProactiveRefresh(),this.currentUser=e,e?await this.assertedPersistence.setCurrentUser(e):await this.assertedPersistence.removeCurrentUser()}queue(e){return this.operations=this.operations.then(e,e),this.operations}get assertedPersistence(){return U(this.persistenceManager,this,"internal-error"),this.persistenceManager}_logFramework(e){e&&!this.frameworks.includes(e)&&(this.frameworks.push(e),this.frameworks.sort(),this.clientVersion=Be(this.config.clientPlatform,this._getFrameworks()))}_getFrameworks(){return this.frameworks}async _getAdditionalHeaders(){const e={"X-Client-Version":this.clientVersion};this.app.options.appId&&(e["X-Firebase-gmpid"]=this.app.options.appId);const t=await(this.heartbeatServiceProvider.getImmediate({optional:!0})?.getHeartbeatsHeader());t&&(e["X-Firebase-Client"]=t);const n=await this._getAppCheckToken();return n&&(e["X-Firebase-AppCheck"]=n),e}async _getAppCheckToken(){if((0,p._isFirebaseServerApp)(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const e=await(this.appCheckServiceProvider.getImmediate({optional:!0})?.getToken());return e?.error&&O(`Error while retrieving App Check token: ${e.error}`),e?.token}}function Ze(e){return(0,f.getModularInstance)(e)}class et{constructor(e){this.auth=e,this.observer=null,this.addObserver=(0,f.createSubscribe)(e=>this.observer=e)}get next(){return U(this.observer,this.auth,"internal-error"),this.observer.next.bind(this.observer)}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */let tt={async loadJS(){throw new Error('Unable to load external scripts')},recaptchaV2Script:'',recaptchaEnterpriseScript:'',gapiScript:''};function nt(e){return tt.loadJS(e)}function rt(e){return`__${e}${Math.floor(1e6*Math.random())}`}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const it=1e12;class st{constructor(e){this.auth=e,this.counter=it,this._widgets=new Map}render(e,t){const n=this.counter;return this._widgets.set(n,new ct(e,this.auth.name,t||{})),this.counter++,n}reset(e){const t=e||it;this._widgets.get(t)?.delete(),this._widgets.delete(t)}getResponse(e){const t=e||it;return this._widgets.get(t)?.getResponse()||''}async execute(e){const t=e||it;return this._widgets.get(t)?.execute(),''}}class at{constructor(){this.enterprise=new ot}ready(e){e()}execute(e,t){return Promise.resolve('token')}render(e,t){return''}}class ot{ready(e){e()}execute(e,t){return Promise.resolve('token')}render(e,t){return''}}class ct{constructor(e,t,n){this.params=n,this.timerId=null,this.deleted=!1,this.responseToken=null,this.clickHandler=()=>{this.execute()};const r='string'==typeof e?document.getElementById(e):e;U(r,"argument-error",{appName:t}),this.container=r,this.isVisible='invisible'!==this.params.size,this.isVisible?this.execute():this.container.addEventListener('click',this.clickHandler)}getResponse(){return this.checkIfDeleted(),this.responseToken}delete(){this.checkIfDeleted(),this.deleted=!0,this.timerId&&(clearTimeout(this.timerId),this.timerId=null),this.container.removeEventListener('click',this.clickHandler)}execute(){this.checkIfDeleted(),this.timerId||(this.timerId=window.setTimeout(()=>{this.responseToken=ut(50);const{callback:e,'expired-callback':t}=this.params;if(e)try{e(this.responseToken)}catch(e){}this.timerId=window.setTimeout(()=>{if(this.timerId=null,this.responseToken=null,t)try{t()}catch(e){}this.isVisible&&this.execute()},6e4)},500))}checkIfDeleted(){if(this.deleted)throw new Error('reCAPTCHA mock was already deleted!')}}function ut(e){const t=[],n='1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';for(let r=0;r<e;r++)t.push(n.charAt(Math.floor(62*Math.random())));return t.join('')}const dt='NO_RECAPTCHA';class lt{constructor(e){this.type="recaptcha-enterprise",this.auth=Ze(e)}async verify(e="verify",t=!1){async function n(e){if(!t){if(null==e.tenantId&&null!=e._agentRecaptchaConfig)return e._agentRecaptchaConfig.siteKey;if(null!=e.tenantId&&void 0!==e._tenantRecaptchaConfigs[e.tenantId])return e._tenantRecaptchaConfigs[e.tenantId].siteKey}return new Promise(async(t,n)=>{oe(e,{clientType:"CLIENT_TYPE_WEB",version:"RECAPTCHA_ENTERPRISE"}).then(r=>{if(void 0!==r.recaptchaKey){const n=new se(r);return null==e.tenantId?e._agentRecaptchaConfig=n:e._tenantRecaptchaConfigs[e.tenantId]=n,t(n.siteKey)}n(new Error('recaptcha Enterprise site key undefined'))}).catch(e=>{n(e)})})}function r(t,n,r){const i=window.grecaptcha;ie(i)?i.enterprise.ready(()=>{i.enterprise.execute(t,{action:e}).then(e=>{n(e)}).catch(()=>{n(dt)})}):r(Error('No reCAPTCHA enterprise script loaded.'))}if(this.auth.settings.appVerificationDisabledForTesting){return(new at).execute('siteKey',{action:'verify'})}return new Promise((e,i)=>{n(this.auth).then(n=>{if(!t&&ie(window.grecaptcha))r(n,e,i);else{if('undefined'==typeof window)return void i(new Error('RecaptchaVerifier is only supported in browser'));let t=tt.recaptchaEnterpriseScript;0!==t.length&&(t+=n),nt(t).then(()=>{r(n,e,i)}).catch(e=>{i(e)})}}).catch(e=>{i(e)})})}}async function ht(e,t,n,r=!1,i=!1){const s=new lt(e);let a;if(i)a=dt;else try{a=await s.verify(n)}catch(e){a=await s.verify(n,!0)}const o=Object.assign({},t);if("mfaSmsEnrollment"===n||"mfaSmsSignIn"===n){if('phoneEnrollmentInfo'in o){const e=o.phoneEnrollmentInfo.phoneNumber,t=o.phoneEnrollmentInfo.recaptchaToken;Object.assign(o,{phoneEnrollmentInfo:{phoneNumber:e,recaptchaToken:t,captchaResponse:a,clientType:"CLIENT_TYPE_WEB",recaptchaVersion:"RECAPTCHA_ENTERPRISE"}})}else if('phoneSignInInfo'in o){const e=o.phoneSignInInfo.recaptchaToken;Object.assign(o,{phoneSignInInfo:{recaptchaToken:e,captchaResponse:a,clientType:"CLIENT_TYPE_WEB",recaptchaVersion:"RECAPTCHA_ENTERPRISE"}})}return o}return r?Object.assign(o,{captchaResp:a}):Object.assign(o,{captchaResponse:a}),Object.assign(o,{clientType:"CLIENT_TYPE_WEB"}),Object.assign(o,{recaptchaVersion:"RECAPTCHA_ENTERPRISE"}),o}async function pt(e,t,n,r,i){if("EMAIL_PASSWORD_PROVIDER"===i){if(e._getRecaptchaConfig()?.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")){const i=await ht(e,t,n,"getOobCode"===n);return r(e,i)}return r(e,t).catch(async i=>{if("auth/missing-recaptcha-token"===i.code){const i=await ht(e,t,n,"getOobCode"===n);return r(e,i)}return Promise.reject(i)})}if("PHONE_PROVIDER"===i){if(e._getRecaptchaConfig()?.isProviderEnabled("PHONE_PROVIDER")){const i=await ht(e,t,n);return r(e,i).catch(async i=>{if("AUDIT"===e._getRecaptchaConfig()?.getProviderEnforcementState("PHONE_PROVIDER")&&("auth/missing-recaptcha-token"===i.code||"auth/invalid-app-credential"===i.code)){const i=await ht(e,t,n,!1,!0);return r(e,i)}return Promise.reject(i)})}{const i=await ht(e,t,n,!1,!0);return r(e,i)}}return Promise.reject(i+' provider is not supported.')}async function ft(e){const t=Ze(e),n=await oe(t,{clientType:"CLIENT_TYPE_WEB",version:"RECAPTCHA_ENTERPRISE"}),r=new se(n);if(null==t.tenantId?t._agentRecaptchaConfig=r:t._tenantRecaptchaConfigs[t.tenantId]=r,r.isAnyProviderEnabled()){new lt(t).verify()}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function mt(e,t){const n=(0,p._getProvider)(e,'auth');if(n.isInitialized()){const e=n.getImmediate(),r=n.getOptions();if((0,f.deepEqual)(r,t??{}))return e;R(e,"already-initialized")}return n.initialize({options:t})}function gt(e,t){const n=t?.persistence||[],r=(Array.isArray(n)?n:[n]).map(Ne);t?.errorMap&&e._updateErrorMap(t.errorMap),e._initializeWithPersistence(r,t?.popupRedirectResolver)}function It(e,t,n){const r=Ze(e);U(/^https?:\/\//.test(t),r,"invalid-emulator-scheme");const i=!!n?.disableWarnings,s=_t(t),{host:a,port:o}=yt(t),c=null===o?'':`:${o}`,u={url:`${s}//${a}${c}/`},d=Object.freeze({host:a,port:o,protocol:s.replace(':',''),options:Object.freeze({disableWarnings:i})});if(!r._canInitEmulator)return U(r.config.emulator&&r.emulatorConfig,r,"emulator-config-failed"),void U((0,f.deepEqual)(u,r.config.emulator)&&(0,f.deepEqual)(d,r.emulatorConfig),r,"emulator-config-failed");r.config.emulator=u,r.emulatorConfig=d,r.settings.appVerificationDisabledForTesting=!0,(0,f.isCloudWorkstation)(a)?((0,f.pingServer)(`${s}//${a}${c}`),(0,f.updateEmulatorBanner)('Auth',!0)):i||Tt()}function _t(e){const t=e.indexOf(':');return t<0?'':e.substr(0,t+1)}function yt(e){const t=_t(e),n=/(\/\/)?([^?#/]+)/.exec(e.substr(t.length));if(!n)return{host:'',port:null};const r=n[2].split('@').pop()||'',i=/^(\[[^\]]+\])(:|$)/.exec(r);if(i){const e=i[1];return{host:e,port:vt(r.substr(e.length+1))}}{const[e,t]=r.split(':');return{host:e,port:vt(t)}}}function vt(e){if(!e)return null;const t=Number(e);return isNaN(t)?null:t}function Tt(){function e(){const e=document.createElement('p'),t=e.style;e.innerText='Running in emulator mode. Do not use with production credentials.',t.position='fixed',t.width='100%',t.backgroundColor='#ffffff',t.border='.1em solid #000000',t.color='#b50000',t.bottom='0px',t.left='0px',t.margin='0px',t.zIndex='10000',t.textAlign='center',e.classList.add('firebase-emulator-warning'),document.body.appendChild(e)}'undefined'!=typeof window&&'undefined'!=typeof document&&('loading'===document.readyState?window.addEventListener('DOMContentLoaded',e):e())}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Et{constructor(e,t){this.providerId=e,this.signInMethod=t}toJSON(){return j('not implemented')}_getIdTokenResponse(e){return j('not implemented')}_linkToIdToken(e,t){return j('not implemented')}_getReauthenticationResolver(e){return j('not implemented')}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function wt(e,t){return Y(e,"POST","/v1/accounts:resetPassword",J(e,t))}async function bt(e,t){return Y(e,"POST","/v1/accounts:update",t)}async function Pt(e,t){return Y(e,"POST","/v1/accounts:signUp",t)}async function St(e,t){return Y(e,"POST","/v1/accounts:update",J(e,t))}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function At(e,t){return Q(e,"POST","/v1/accounts:signInWithPassword",J(e,t))}async function Ot(e,t){return Y(e,"POST","/v1/accounts:sendOobCode",J(e,t))}async function kt(e,t){return Ot(e,t)}async function Rt(e,t){return Ot(e,t)}async function Nt(e,t){return Ot(e,t)}async function Ct(e,t){return Ot(e,t)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Dt(e,t){return Q(e,"POST","/v1/accounts:signInWithEmailLink",J(e,t))}async function Lt(e,t){return Q(e,"POST","/v1/accounts:signInWithEmailLink",J(e,t))}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Mt extends Et{constructor(e,t,n,r=null){super("password",n),this._email=e,this._password=t,this._tenantId=r}static _fromEmailAndPassword(e,t){return new Mt(e,t,"password")}static _fromEmailAndCode(e,t,n=null){return new Mt(e,t,"emailLink",n)}toJSON(){return{email:this._email,password:this._password,signInMethod:this.signInMethod,tenantId:this._tenantId}}static fromJSON(e){const t='string'==typeof e?JSON.parse(e):e;if(t?.email&&t?.password){if("password"===t.signInMethod)return this._fromEmailAndPassword(t.email,t.password);if("emailLink"===t.signInMethod)return this._fromEmailAndCode(t.email,t.password,t.tenantId)}return null}async _getIdTokenResponse(e){switch(this.signInMethod){case"password":return pt(e,{returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"},"signInWithPassword",At,"EMAIL_PASSWORD_PROVIDER");case"emailLink":return Dt(e,{email:this._email,oobCode:this._password});default:R(e,"internal-error")}}async _linkToIdToken(e,t){switch(this.signInMethod){case"password":return pt(e,{idToken:t,returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"},"signUpPassword",Pt,"EMAIL_PASSWORD_PROVIDER");case"emailLink":return Lt(e,{idToken:t,email:this._email,oobCode:this._password});default:R(e,"internal-error")}}_getReauthenticationResolver(e){return this._getIdTokenResponse(e)}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Ut(e,t){return Q(e,"POST","/v1/accounts:signInWithIdp",J(e,t))}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class jt extends Et{constructor(){super(...arguments),this.pendingToken=null}static _fromParams(e){const t=new jt(e.providerId,e.signInMethod);return e.idToken||e.accessToken?(e.idToken&&(t.idToken=e.idToken),e.accessToken&&(t.accessToken=e.accessToken),e.nonce&&!e.pendingToken&&(t.nonce=e.nonce),e.pendingToken&&(t.pendingToken=e.pendingToken)):e.oauthToken&&e.oauthTokenSecret?(t.accessToken=e.oauthToken,t.secret=e.oauthTokenSecret):R("argument-error"),t}toJSON(){return{idToken:this.idToken,accessToken:this.accessToken,secret:this.secret,nonce:this.nonce,pendingToken:this.pendingToken,providerId:this.providerId,signInMethod:this.signInMethod}}static fromJSON(e){const t='string'==typeof e?JSON.parse(e):e,{providerId:n,signInMethod:r}=t,i=(0,h.default)(t,u);if(!n||!r)return null;const s=new jt(n,r);return s.idToken=i.idToken||void 0,s.accessToken=i.accessToken||void 0,s.secret=i.secret,s.nonce=i.nonce,s.pendingToken=i.pendingToken||null,s}_getIdTokenResponse(e){return Ut(e,this.buildRequest())}_linkToIdToken(e,t){const n=this.buildRequest();return n.idToken=t,Ut(e,n)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,Ut(e,t)}buildRequest(){const e={requestUri:"http://localhost",returnSecureToken:!0};if(this.pendingToken)e.pendingToken=this.pendingToken;else{const t={};this.idToken&&(t.id_token=this.idToken),this.accessToken&&(t.access_token=this.accessToken),this.secret&&(t.oauth_token_secret=this.secret),t.providerId=this.providerId,this.nonce&&!this.pendingToken&&(t.nonce=this.nonce),e.postBody=(0,f.querystring)(t)}return e}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Ft(e,t){return Y(e,"POST","/v1/accounts:sendVerificationCode",J(e,t))}async function Vt(e,t){return Q(e,"POST","/v1/accounts:signInWithPhoneNumber",J(e,t))}async function xt(e,t){const n=await Q(e,"POST","/v1/accounts:signInWithPhoneNumber",J(e,t));if(n.temporaryProof)throw ne(e,"account-exists-with-different-credential",n);return n}const Ht={USER_NOT_FOUND:"user-not-found"};async function qt(e,t){return Q(e,"POST","/v1/accounts:signInWithPhoneNumber",J(e,Object.assign({},t,{operation:'REAUTH'})),Ht)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Wt extends Et{constructor(e){super("phone","phone"),this.params=e}static _fromVerification(e,t){return new Wt({verificationId:e,verificationCode:t})}static _fromTokenResponse(e,t){return new Wt({phoneNumber:e,temporaryProof:t})}_getIdTokenResponse(e){return Vt(e,this._makeVerificationRequest())}_linkToIdToken(e,t){return xt(e,Object.assign({idToken:t},this._makeVerificationRequest()))}_getReauthenticationResolver(e){return qt(e,this._makeVerificationRequest())}_makeVerificationRequest(){const{temporaryProof:e,phoneNumber:t,verificationId:n,verificationCode:r}=this.params;return e&&t?{temporaryProof:e,phoneNumber:t}:{sessionInfo:n,code:r}}toJSON(){const e={providerId:this.providerId};return this.params.phoneNumber&&(e.phoneNumber=this.params.phoneNumber),this.params.temporaryProof&&(e.temporaryProof=this.params.temporaryProof),this.params.verificationCode&&(e.verificationCode=this.params.verificationCode),this.params.verificationId&&(e.verificationId=this.params.verificationId),e}static fromJSON(e){'string'==typeof e&&(e=JSON.parse(e));const{verificationId:t,verificationCode:n,phoneNumber:r,temporaryProof:i}=e;return n||t||r||i?new Wt({verificationId:t,verificationCode:n,phoneNumber:r,temporaryProof:i}):null}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function zt(e){switch(e){case'recoverEmail':return"RECOVER_EMAIL";case'resetPassword':return"PASSWORD_RESET";case'signIn':return"EMAIL_SIGNIN";case'verifyEmail':return"VERIFY_EMAIL";case'verifyAndChangeEmail':return"VERIFY_AND_CHANGE_EMAIL";case'revertSecondFactorAddition':return"REVERT_SECOND_FACTOR_ADDITION";default:return null}}function Gt(e){const t=(0,f.querystringDecode)((0,f.extractQuerystring)(e)).link,n=t?(0,f.querystringDecode)((0,f.extractQuerystring)(t)).deep_link_id:null,r=(0,f.querystringDecode)((0,f.extractQuerystring)(e)).deep_link_id;return(r?(0,f.querystringDecode)((0,f.extractQuerystring)(r)).link:null)||r||n||t||e}class Kt{constructor(e){const t=(0,f.querystringDecode)((0,f.extractQuerystring)(e)),n=t.apiKey??null,r=t.oobCode??null,i=zt(t.mode??null);U(n&&r&&i,"argument-error"),this.apiKey=n,this.operation=i,this.code=r,this.continueUrl=t.continueUrl??null,this.languageCode=t.lang??null,this.tenantId=t.tenantId??null}static parseLink(e){const t=Gt(e);try{return new Kt(t)}catch{return null}}}function $t(e){return Kt.parseLink(e)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Bt{constructor(){this.providerId=Bt.PROVIDER_ID}static credential(e,t){return Mt._fromEmailAndPassword(e,t)}static credentialWithLink(e,t){const n=Kt.parseLink(t);return U(n,"argument-error"),Mt._fromEmailAndCode(e,n.code,n.tenantId)}}Bt.PROVIDER_ID="password",Bt.EMAIL_PASSWORD_SIGN_IN_METHOD="password",Bt.EMAIL_LINK_SIGN_IN_METHOD="emailLink";
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
class Jt{constructor(e){this.providerId=e,this.defaultLanguageCode=null,this.customParameters={}}setDefaultLanguage(e){this.defaultLanguageCode=e}setCustomParameters(e){return this.customParameters=e,this}getCustomParameters(){return this.customParameters}}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Yt extends Jt{constructor(){super(...arguments),this.scopes=[]}addScope(e){return this.scopes.includes(e)||this.scopes.push(e),this}getScopes(){return[...this.scopes]}}class Xt extends Yt{static credentialFromJSON(e){const t='string'==typeof e?JSON.parse(e):e;return U('providerId'in t&&'signInMethod'in t,"argument-error"),jt._fromParams(t)}credential(e){return this._credential(Object.assign({},e,{nonce:e.rawNonce}))}_credential(e){return U(e.idToken||e.accessToken,"argument-error"),jt._fromParams(Object.assign({},e,{providerId:this.providerId,signInMethod:this.providerId}))}static credentialFromResult(e){return Xt.oauthCredentialFromTaggedObject(e)}static credentialFromError(e){return Xt.oauthCredentialFromTaggedObject(e.customData||{})}static oauthCredentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:n,oauthTokenSecret:r,pendingToken:i,nonce:s,providerId:a}=e;if(!(n||r||t||i))return null;if(!a)return null;try{return new Xt(a)._credential({idToken:t,accessToken:n,nonce:s,pendingToken:i})}catch(e){return null}}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Qt extends Yt{constructor(){super("facebook.com")}static credential(e){return jt._fromParams({providerId:Qt.PROVIDER_ID,signInMethod:Qt.FACEBOOK_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return Qt.credentialFromTaggedObject(e)}static credentialFromError(e){return Qt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!('oauthAccessToken'in e))return null;if(!e.oauthAccessToken)return null;try{return Qt.credential(e.oauthAccessToken)}catch{return null}}}Qt.FACEBOOK_SIGN_IN_METHOD="facebook.com",Qt.PROVIDER_ID="facebook.com";
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
class Zt extends Yt{constructor(){super("google.com"),this.addScope('profile')}static credential(e,t){return jt._fromParams({providerId:Zt.PROVIDER_ID,signInMethod:Zt.GOOGLE_SIGN_IN_METHOD,idToken:e,accessToken:t})}static credentialFromResult(e){return Zt.credentialFromTaggedObject(e)}static credentialFromError(e){return Zt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:n}=e;if(!t&&!n)return null;try{return Zt.credential(t,n)}catch{return null}}}Zt.GOOGLE_SIGN_IN_METHOD="google.com",Zt.PROVIDER_ID="google.com";
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
class en extends Yt{constructor(){super("github.com")}static credential(e){return jt._fromParams({providerId:en.PROVIDER_ID,signInMethod:en.GITHUB_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return en.credentialFromTaggedObject(e)}static credentialFromError(e){return en.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!('oauthAccessToken'in e))return null;if(!e.oauthAccessToken)return null;try{return en.credential(e.oauthAccessToken)}catch{return null}}}en.GITHUB_SIGN_IN_METHOD="github.com",en.PROVIDER_ID="github.com";class tn extends Et{constructor(e,t){super(e,e),this.pendingToken=t}_getIdTokenResponse(e){return Ut(e,this.buildRequest())}_linkToIdToken(e,t){const n=this.buildRequest();return n.idToken=t,Ut(e,n)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,Ut(e,t)}toJSON(){return{signInMethod:this.signInMethod,providerId:this.providerId,pendingToken:this.pendingToken}}static fromJSON(e){const t='string'==typeof e?JSON.parse(e):e,{providerId:n,signInMethod:r,pendingToken:i}=t;return n&&r&&i&&n===r?new tn(n,i):null}static _create(e,t){return new tn(e,t)}buildRequest(){return{requestUri:"http://localhost",returnSecureToken:!0,pendingToken:this.pendingToken}}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class nn extends Jt{constructor(e){U(e.startsWith("saml."),"argument-error"),super(e)}static credentialFromResult(e){return nn.samlCredentialFromTaggedObject(e)}static credentialFromError(e){return nn.samlCredentialFromTaggedObject(e.customData||{})}static credentialFromJSON(e){const t=tn.fromJSON(e);return U(t,"argument-error"),t}static samlCredentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{pendingToken:t,providerId:n}=e;if(!t||!n)return null;try{return tn._create(n,t)}catch(e){return null}}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class rn extends Yt{constructor(){super("twitter.com")}static credential(e,t){return jt._fromParams({providerId:rn.PROVIDER_ID,signInMethod:rn.TWITTER_SIGN_IN_METHOD,oauthToken:e,oauthTokenSecret:t})}static credentialFromResult(e){return rn.credentialFromTaggedObject(e)}static credentialFromError(e){return rn.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthAccessToken:t,oauthTokenSecret:n}=e;if(!t||!n)return null;try{return rn.credential(t,n)}catch{return null}}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
async function sn(e,t){return Q(e,"POST","/v1/accounts:signUp",J(e,t))}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */rn.TWITTER_SIGN_IN_METHOD="twitter.com",rn.PROVIDER_ID="twitter.com";class an{constructor(e){this.user=e.user,this.providerId=e.providerId,this._tokenResponse=e._tokenResponse,this.operationType=e.operationType}static async _fromIdTokenResponse(e,t,n,r=!1){const i=await ke._fromIdTokenResponse(e,n,r),s=on(n);return new an({user:i,providerId:s,_tokenResponse:n,operationType:t})}static async _forOperation(e,t,n){await e._updateTokensIfNecessary(n,!0);const r=on(n);return new an({user:e,providerId:r,_tokenResponse:n,operationType:t})}}function on(e){return e.providerId?e.providerId:'phoneNumber'in e?"phone":null}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function cn(e){if((0,p._isFirebaseServerApp)(e.app))return Promise.reject(D(e));const t=Ze(e);if(await t._initializationPromise,t.currentUser?.isAnonymous)return new an({user:t.currentUser,providerId:null,operationType:"signIn"});const n=await sn(t,{returnSecureToken:!0}),r=await an._fromIdTokenResponse(t,"signIn",n,!0);return await t._updateCurrentUser(r.user),r}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class un extends f.FirebaseError{constructor(e,t,n,r){super(t.code,t.message),this.operationType=n,this.user=r,Object.setPrototypeOf(this,un.prototype),this.customData={appName:e.name,tenantId:e.tenantId??void 0,_serverResponse:t.customData._serverResponse,operationType:n}}static _fromErrorAndOperation(e,t,n,r){return new un(e,t,n,r)}}function dn(e,t,n,r){return("reauthenticate"===t?n._getReauthenticationResolver(e):n._getIdTokenResponse(e)).catch(n=>{if("auth/multi-factor-auth-required"===n.code)throw un._fromErrorAndOperation(e,n,t,r);throw n})}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function ln(e){return new Set(e.map(({providerId:e})=>e).filter(e=>!!e))}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function hn(e,t){const n=(0,f.getModularInstance)(e);await fn(!0,n,t);const{providerUserInfo:r}=await ue(n.auth,{idToken:await n.getIdToken(),deleteProvider:[t]}),i=ln(r||[]);return n.providerData=n.providerData.filter(e=>i.has(e.providerId)),i.has("phone")||(n.phoneNumber=null),await n.auth._persistUserIfCurrent(n),n}async function pn(e,t,n=!1){const r=await Ie(e,t._linkToIdToken(e.auth,await e.getIdToken()),n);return an._forOperation(e,"link",r)}async function fn(e,t,n){await Te(t);const r=!1===e?"provider-already-linked":"no-such-provider";U(ln(t.providerData).has(n)===e,t.auth,r)}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function mn(e,t,n=!1){const{auth:r}=e;if((0,p._isFirebaseServerApp)(r.app))return Promise.reject(D(r));const i="reauthenticate";try{const s=await Ie(e,dn(r,i,t,e),n);U(s.idToken,r,"internal-error");const a=me(s.idToken);U(a,r,"internal-error");const{sub:o}=a;return U(e.uid===o,r,"user-mismatch"),an._forOperation(e,i,s)}catch(e){throw"auth/user-not-found"===e?.code&&R(r,"user-mismatch"),e}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function gn(e,t,n=!1){if((0,p._isFirebaseServerApp)(e.app))return Promise.reject(D(e));const r="signIn",i=await dn(e,r,t),s=await an._fromIdTokenResponse(e,r,i);return n||await e._updateCurrentUser(s.user),s}async function In(e,t){return gn(Ze(e),t)}async function _n(e,t){const n=(0,f.getModularInstance)(e);return await fn(!1,n,t.providerId),pn(n,t)}async function yn(e,t){return mn((0,f.getModularInstance)(e),t)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function vn(e,t){return Q(e,"POST","/v1/accounts:signInWithCustomToken",J(e,t))}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Tn(e,t){if((0,p._isFirebaseServerApp)(e.app))return Promise.reject(D(e));const n=Ze(e),r=await vn(n,{token:t,returnSecureToken:!0}),i=await an._fromIdTokenResponse(n,"signIn",r);return await n._updateCurrentUser(i.user),i}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class En{constructor(e,t){this.factorId=e,this.uid=t.mfaEnrollmentId,this.enrollmentTime=new Date(t.enrolledAt).toUTCString(),this.displayName=t.displayName}static _fromServerResponse(e,t){return'phoneInfo'in t?wn._fromServerResponse(e,t):'totpInfo'in t?bn._fromServerResponse(e,t):R(e,"internal-error")}}class wn extends En{constructor(e){super("phone",e),this.phoneNumber=e.phoneInfo}static _fromServerResponse(e,t){return new wn(t)}}class bn extends En{constructor(e){super("totp",e)}static _fromServerResponse(e,t){return new bn(t)}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Pn(e,t,n){U(n.url?.length>0,e,"invalid-continue-uri"),U(void 0===n.dynamicLinkDomain||n.dynamicLinkDomain.length>0,e,"invalid-dynamic-link-domain"),U(void 0===n.linkDomain||n.linkDomain.length>0,e,"invalid-hosting-link-domain"),t.continueUrl=n.url,t.dynamicLinkDomain=n.dynamicLinkDomain,t.linkDomain=n.linkDomain,t.canHandleCodeInApp=n.handleCodeInApp,n.iOS&&(U(n.iOS.bundleId.length>0,e,"missing-ios-bundle-id"),t.iOSBundleId=n.iOS.bundleId),n.android&&(U(n.android.packageName.length>0,e,"missing-android-pkg-name"),t.androidInstallApp=n.android.installApp,t.androidMinimumVersionCode=n.android.minimumVersion,t.androidPackageName=n.android.packageName)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Sn(e){const t=Ze(e);t._getPasswordPolicyInternal()&&await t._updatePasswordPolicy()}async function An(e,t,n){const r=Ze(e),i={requestType:"PASSWORD_RESET",email:t,clientType:"CLIENT_TYPE_WEB"};n&&Pn(r,i,n),await pt(r,i,"getOobCode",Rt,"EMAIL_PASSWORD_PROVIDER")}async function On(e,t,n){await wt((0,f.getModularInstance)(e),{oobCode:t,newPassword:n}).catch(async t=>{throw"auth/password-does-not-meet-requirements"===t.code&&Sn(e),t})}async function kn(e,t){await St((0,f.getModularInstance)(e),{oobCode:t})}async function Rn(e,t){const n=(0,f.getModularInstance)(e),r=await wt(n,{oobCode:t}),i=r.requestType;switch(U(i,n,"internal-error"),i){case"EMAIL_SIGNIN":break;case"VERIFY_AND_CHANGE_EMAIL":U(r.newEmail,n,"internal-error");break;case"REVERT_SECOND_FACTOR_ADDITION":U(r.mfaInfo,n,"internal-error");default:U(r.email,n,"internal-error")}let s=null;return r.mfaInfo&&(s=En._fromServerResponse(Ze(n),r.mfaInfo)),{data:{email:("VERIFY_AND_CHANGE_EMAIL"===r.requestType?r.newEmail:r.email)||null,previousEmail:("VERIFY_AND_CHANGE_EMAIL"===r.requestType?r.email:r.newEmail)||null,multiFactorInfo:s},operation:i}}async function Nn(e,t){const{data:n}=await Rn((0,f.getModularInstance)(e),t);return n.email}async function Cn(e,t,n){if((0,p._isFirebaseServerApp)(e.app))return Promise.reject(D(e));const r=Ze(e),i=pt(r,{returnSecureToken:!0,email:t,password:n,clientType:"CLIENT_TYPE_WEB"},"signUpPassword",sn,"EMAIL_PASSWORD_PROVIDER"),s=await i.catch(t=>{throw"auth/password-does-not-meet-requirements"===t.code&&Sn(e),t}),a=await an._fromIdTokenResponse(r,"signIn",s);return await r._updateCurrentUser(a.user),a}function Dn(e,t,n){return(0,p._isFirebaseServerApp)(e.app)?Promise.reject(D(e)):In((0,f.getModularInstance)(e),Bt.credential(t,n)).catch(async t=>{throw"auth/password-does-not-meet-requirements"===t.code&&Sn(e),t})}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Ln(e,t,n){const r=Ze(e),i={requestType:"EMAIL_SIGNIN",email:t,clientType:"CLIENT_TYPE_WEB"};!(function(e,t){U(t.handleCodeInApp,r,"argument-error"),t&&Pn(r,e,t)})(i,n),await pt(r,i,"getOobCode",Nt,"EMAIL_PASSWORD_PROVIDER")}function Mn(e,t){const n=Kt.parseLink(t);return"EMAIL_SIGNIN"===n?.operation}async function Un(e,t,n){if((0,p._isFirebaseServerApp)(e.app))return Promise.reject(D(e));const r=(0,f.getModularInstance)(e),i=Bt.credentialWithLink(t,n||V());return U(i._tenantId===(r.tenantId||null),r,"tenant-id-mismatch"),In(r,i)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function jn(e,t){return Y(e,"POST","/v1/accounts:createAuthUri",J(e,t))}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Fn(e,t){const n={identifier:t,continueUri:x()?V():'http://localhost'},{signinMethods:r}=await jn((0,f.getModularInstance)(e),n);return r||[]}async function Vn(e,t){const n=(0,f.getModularInstance)(e),r={requestType:"VERIFY_EMAIL",idToken:await e.getIdToken()};t&&Pn(n.auth,r,t);const{email:i}=await kt(n.auth,r);i!==e.email&&await e.reload()}async function xn(e,t,n){const r=(0,f.getModularInstance)(e),i={requestType:"VERIFY_AND_CHANGE_EMAIL",idToken:await e.getIdToken(),newEmail:t};n&&Pn(r.auth,i,n);const{email:s}=await Ct(r.auth,i);s!==e.email&&await e.reload()}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Hn(e,t){return Y(e,"POST","/v1/accounts:update",t)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function qn(e,{displayName:t,photoURL:n}){if(void 0===t&&void 0===n)return;const r=(0,f.getModularInstance)(e),i={idToken:await r.getIdToken(),displayName:t,photoUrl:n,returnSecureToken:!0},s=await Ie(r,Hn(r.auth,i));r.displayName=s.displayName||null,r.photoURL=s.photoUrl||null;const a=r.providerData.find(({providerId:e})=>"password"===e);a&&(a.displayName=r.displayName,a.photoURL=r.photoURL),await r._updateTokensIfNecessary(s)}function Wn(e,t){const n=(0,f.getModularInstance)(e);return(0,p._isFirebaseServerApp)(n.auth.app)?Promise.reject(D(n.auth)):Gn(n,t,null)}function zn(e,t){return Gn((0,f.getModularInstance)(e),null,t)}async function Gn(e,t,n){const{auth:r}=e,i={idToken:await e.getIdToken(),returnSecureToken:!0};t&&(i.email=t),n&&(i.password=n);const s=await Ie(e,bt(r,i));await e._updateTokensIfNecessary(s,!0)}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Kn(e){if(!e)return null;const{providerId:t}=e,n=e.rawUserInfo?JSON.parse(e.rawUserInfo):{},r=e.isNewUser||"identitytoolkit#SignupNewUserResponse"===e.kind;if(!t&&e?.idToken){const t=me(e.idToken)?.firebase?.sign_in_provider;if(t){return new $n(r,"anonymous"!==t&&"custom"!==t?t:null)}}if(!t)return null;switch(t){case"facebook.com":return new Jn(r,n);case"github.com":return new Yn(r,n);case"google.com":return new Xn(r,n);case"twitter.com":return new Qn(r,n,e.screenName||null);case"custom":case"anonymous":return new $n(r,null);default:return new $n(r,t,n)}}class $n{constructor(e,t,n={}){this.isNewUser=e,this.providerId=t,this.profile=n}}class Bn extends $n{constructor(e,t,n,r){super(e,t,n),this.username=r}}class Jn extends $n{constructor(e,t){super(e,"facebook.com",t)}}class Yn extends Bn{constructor(e,t){super(e,"github.com",t,'string'==typeof t?.login?t?.login:null)}}class Xn extends $n{constructor(e,t){super(e,"google.com",t)}}class Qn extends Bn{constructor(e,t,n){super(e,"twitter.com",t,n)}}function Zn(e){const{user:t,_tokenResponse:n}=e;return t.isAnonymous&&!n?{providerId:null,isNewUser:!1,profile:null}:Kn(n)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function er(e,t){return(0,f.getModularInstance)(e).setPersistence(t)}function tr(e){return ft(e)}async function nr(e,t){return Ze(e).validatePassword(t)}function rr(e,t,n,r){return(0,f.getModularInstance)(e).onIdTokenChanged(t,n,r)}function ir(e,t,n){return(0,f.getModularInstance)(e).beforeAuthStateChanged(t,n)}function sr(e,t,n,r){return(0,f.getModularInstance)(e).onAuthStateChanged(t,n,r)}function ar(e){(0,f.getModularInstance)(e).useDeviceLanguage()}function or(e,t){return(0,f.getModularInstance)(e).updateCurrentUser(t)}function cr(e){return(0,f.getModularInstance)(e).signOut()}function ur(e,t){return Ze(e).revokeAccessToken(t)}async function dr(e){return(0,f.getModularInstance)(e).delete()}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class lr{constructor(e,t,n){this.type=e,this.credential=t,this.user=n}static _fromIdtoken(e,t){return new lr("enroll",e,t)}static _fromMfaPendingCredential(e){return new lr("signin",e)}toJSON(){const e="enroll"===this.type?'idToken':'pendingCredential';return{multiFactorSession:{[e]:this.credential}}}static fromJSON(e){if(e?.multiFactorSession){if(e.multiFactorSession?.pendingCredential)return lr._fromMfaPendingCredential(e.multiFactorSession.pendingCredential);if(e.multiFactorSession?.idToken)return lr._fromIdtoken(e.multiFactorSession.idToken)}return null}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class hr{constructor(e,t,n){this.session=e,this.hints=t,this.signInResolver=n}static _fromError(e,t){const n=Ze(e),r=t.customData._serverResponse,i=(r.mfaInfo||[]).map(e=>En._fromServerResponse(n,e));U(r.mfaPendingCredential,n,"internal-error");const s=lr._fromMfaPendingCredential(r.mfaPendingCredential);return new hr(s,i,async e=>{const i=await e._process(n,s);delete r.mfaInfo,delete r.mfaPendingCredential;const a=Object.assign({},r,{idToken:i.idToken,refreshToken:i.refreshToken});switch(t.operationType){case"signIn":const e=await an._fromIdTokenResponse(n,t.operationType,a);return await n._updateCurrentUser(e.user),e;case"reauthenticate":return U(t.user,n,"internal-error"),an._forOperation(t.user,t.operationType,a);default:R(n,"internal-error")}})}async resolveSignIn(e){const t=e;return this.signInResolver(t)}}function pr(e,t){const n=(0,f.getModularInstance)(e),r=t;return U(t.customData.operationType,n,"argument-error"),U(r.customData._serverResponse?.mfaPendingCredential,n,"argument-error"),hr._fromError(n,r)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function fr(e,t){return Y(e,"POST","/v2/accounts/mfaEnrollment:start",J(e,t))}function mr(e,t){return Y(e,"POST","/v2/accounts/mfaEnrollment:finalize",J(e,t))}function gr(e,t){return Y(e,"POST","/v2/accounts/mfaEnrollment:finalize",J(e,t))}class Ir{constructor(e){this.user=e,this.enrolledFactors=[],e._onReload(t=>{t.mfaInfo&&(this.enrolledFactors=t.mfaInfo.map(t=>En._fromServerResponse(e.auth,t)))})}static _fromUser(e){return new Ir(e)}async getSession(){return lr._fromIdtoken(await this.user.getIdToken(),this.user)}async enroll(e,t){const n=e,r=await this.getSession(),i=await Ie(this.user,n._process(this.user.auth,r,t));return await this.user._updateTokensIfNecessary(i),this.user.reload()}async unenroll(e){const t='string'==typeof e?e:e.uid,n=await this.user.getIdToken();try{const e=await Ie(this.user,(r=this.user.auth,i={idToken:n,mfaEnrollmentId:t},Y(r,"POST","/v2/accounts/mfaEnrollment:withdraw",J(r,i))));this.enrolledFactors=this.enrolledFactors.filter(({uid:e})=>e!==t),await this.user._updateTokensIfNecessary(e),await this.user.reload()}catch(e){throw e}var r,i}}const _r=new WeakMap;function yr(e){const t=(0,f.getModularInstance)(e);return _r.has(t)||_r.set(t,Ir._fromUser(t)),_r.get(t)}const vr='__sak';
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Tr{constructor(e,t){this.storageRetriever=e,this.type=t}_isAvailable(){try{return this.storage?(this.storage.setItem(vr,'1'),this.storage.removeItem(vr),Promise.resolve(!0)):Promise.resolve(!1)}catch{return Promise.resolve(!1)}}_set(e,t){return this.storage.setItem(e,JSON.stringify(t)),Promise.resolve()}_get(e){const t=this.storage.getItem(e);return Promise.resolve(t?JSON.parse(t):null)}_remove(e){return this.storage.removeItem(e),Promise.resolve()}get storage(){return this.storageRetriever()}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Er extends Tr{constructor(){super(()=>window.localStorage,"LOCAL"),this.boundEventHandler=(e,t)=>this.onStorageEvent(e,t),this.listeners={},this.localCache={},this.pollTimer=null,this.fallbackToPolling=$e(),this._shouldAllowMigration=!0}forAllChangedKeys(e){for(const t of Object.keys(this.listeners)){const n=this.storage.getItem(t),r=this.localCache[t];n!==r&&e(t,r,n)}}onStorageEvent(e,t=!1){if(!e.key)return void this.forAllChangedKeys((e,t,n)=>{this.notifyListeners(e,n)});const n=e.key;t?this.detachListener():this.stopPolling();const r=()=>{const e=this.storage.getItem(n);(t||this.localCache[n]!==e)&&this.notifyListeners(n,e)},i=this.storage.getItem(n);(0,f.isIE)()&&10===document.documentMode&&i!==e.newValue&&e.newValue!==e.oldValue?setTimeout(r,10):r()}notifyListeners(e,t){this.localCache[e]=t;const n=this.listeners[e];if(n)for(const e of Array.from(n))e(t?JSON.parse(t):t)}startPolling(){this.stopPolling(),this.pollTimer=setInterval(()=>{this.forAllChangedKeys((e,t,n)=>{this.onStorageEvent(new StorageEvent('storage',{key:e,oldValue:t,newValue:n}),!0)})},1e3)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}attachListener(){window.addEventListener('storage',this.boundEventHandler)}detachListener(){window.removeEventListener('storage',this.boundEventHandler)}_addListener(e,t){0===Object.keys(this.listeners).length&&(this.fallbackToPolling?this.startPolling():this.attachListener()),this.listeners[e]||(this.listeners[e]=new Set,this.localCache[e]=this.storage.getItem(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),0===this.listeners[e].size&&delete this.listeners[e]),0===Object.keys(this.listeners).length&&(this.detachListener(),this.stopPolling())}async _set(e,t){await super._set(e,t),this.localCache[e]=JSON.stringify(t)}async _get(e){const t=await super._get(e);return this.localCache[e]=JSON.stringify(t),t}async _remove(e){await super._remove(e),delete this.localCache[e]}}Er.type='LOCAL';const wr=Er;
/**
   * @license
   * Copyright 2025 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function br(e){const t=e.replace(/[\\^$.*+?()[\]{}|]/g,'\\$&'),n=RegExp(`${t}=([^;]+)`);return document.cookie.match(n)?.[1]??null}function Pr(e){return`${'http:'===window.location.protocol?'__dev_':'__HOST-'}FIREBASE_${e.split(':')[3]}`}class Sr{constructor(){this.type="COOKIE",this.listenerUnsubscribes=new Map}_getFinalTarget(e){if(void 0===typeof window)return e;const t=new URL(`${window.location.origin}/__cookies__`);return t.searchParams.set('finalTarget',e),t}async _isAvailable(){return!('boolean'==typeof isSecureContext&&!isSecureContext)&&('undefined'!=typeof navigator&&'undefined'!=typeof document&&(navigator.cookieEnabled??!0))}async _set(e,t){}async _get(e){if(!this._isAvailable())return null;const t=Pr(e);if(window.cookieStore){const e=await window.cookieStore.get(t);return e?.value}return br(t)}async _remove(e){if(!this._isAvailable())return;if(!await this._get(e))return;const t=Pr(e);document.cookie=`${t}=;Max-Age=34560000;Partitioned;Secure;SameSite=Strict;Path=/;Priority=High`,await fetch("/__cookies__",{method:'DELETE'}).catch(()=>{})}_addListener(e,t){if(!this._isAvailable())return;const n=Pr(e);if(window.cookieStore){const e=e=>{const r=e.changed.find(e=>e.name===n);r&&t(r.value);e.deleted.find(e=>e.name===n)&&t(null)},r=()=>window.cookieStore.removeEventListener('change',e);return this.listenerUnsubscribes.set(t,r),window.cookieStore.addEventListener('change',e)}let r=br(n);const i=setInterval(()=>{const e=br(n);e!==r&&(t(e),r=e)},1e3);this.listenerUnsubscribes.set(t,()=>clearInterval(i))}_removeListener(e,t){const n=this.listenerUnsubscribes.get(t);n&&(n(),this.listenerUnsubscribes.delete(t))}}Sr.type='COOKIE';const Ar=Sr;
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Or extends Tr{constructor(){super(()=>window.sessionStorage,"SESSION")}_addListener(e,t){}_removeListener(e,t){}}Or.type='SESSION';const kr=Or;
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Rr(e){return Promise.all(e.map(async e=>{try{return{fulfilled:!0,value:await e}}catch(e){return{fulfilled:!1,reason:e}}}))}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Nr{constructor(e){this.eventTarget=e,this.handlersMap={},this.boundEventHandler=this.handleEvent.bind(this)}static _getInstance(e){const t=this.receivers.find(t=>t.isListeningto(e));if(t)return t;const n=new Nr(e);return this.receivers.push(n),n}isListeningto(e){return this.eventTarget===e}async handleEvent(e){const t=e,{eventId:n,eventType:r,data:i}=t.data,s=this.handlersMap[r];if(!s?.size)return;t.ports[0].postMessage({status:"ack",eventId:n,eventType:r});const a=Array.from(s).map(async e=>e(t.origin,i)),o=await Rr(a);t.ports[0].postMessage({status:"done",eventId:n,eventType:r,response:o})}_subscribe(e,t){0===Object.keys(this.handlersMap).length&&this.eventTarget.addEventListener('message',this.boundEventHandler),this.handlersMap[e]||(this.handlersMap[e]=new Set),this.handlersMap[e].add(t)}_unsubscribe(e,t){this.handlersMap[e]&&t&&this.handlersMap[e].delete(t),t&&0!==this.handlersMap[e].size||delete this.handlersMap[e],0===Object.keys(this.handlersMap).length&&this.eventTarget.removeEventListener('message',this.boundEventHandler)}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
function Cr(e="",t=10){let n='';for(let e=0;e<t;e++)n+=Math.floor(10*Math.random());return e+n}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */Nr.receivers=[];class Dr{constructor(e){this.target=e,this.handlers=new Set}removeMessageHandler(e){e.messageChannel&&(e.messageChannel.port1.removeEventListener('message',e.onMessage),e.messageChannel.port1.close()),this.handlers.delete(e)}async _send(e,t,n=50){const r='undefined'!=typeof MessageChannel?new MessageChannel:null;if(!r)throw new Error("connection_unavailable");let i,s;return new Promise((a,o)=>{const c=Cr('',20);r.port1.start();const u=setTimeout(()=>{o(new Error("unsupported_event"))},n);s={messageChannel:r,onMessage(e){const t=e;if(t.data.eventId===c)switch(t.data.status){case"ack":clearTimeout(u),i=setTimeout(()=>{o(new Error("timeout"))},3e3);break;case"done":clearTimeout(i),a(t.data.response);break;default:clearTimeout(u),clearTimeout(i),o(new Error("invalid_response"))}}},this.handlers.add(s),r.port1.addEventListener('message',s.onMessage),this.target.postMessage({eventType:e,eventId:c,data:t},[r.port2])}).finally(()=>{s&&this.removeMessageHandler(s)})}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Lr(){return window}function Mr(e){Lr().location.href=e}
/**
   * @license
   * Copyright 2020 Google LLC.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Ur(){return void 0!==Lr().WorkerGlobalScope&&'function'==typeof Lr().importScripts}async function jr(){if(!navigator?.serviceWorker)return null;try{return(await navigator.serviceWorker.ready).active}catch{return null}}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
const Fr='firebaseLocalStorageDb',Vr='firebaseLocalStorage',xr='fbase_key';class Hr{constructor(e){this.request=e}toPromise(){return new Promise((e,t)=>{this.request.addEventListener('success',()=>{e(this.request.result)}),this.request.addEventListener('error',()=>{t(this.request.error)})})}}function qr(e,t){return e.transaction([Vr],t?'readwrite':'readonly').objectStore(Vr)}function Wr(){const e=indexedDB.deleteDatabase(Fr);return new Hr(e).toPromise()}function zr(){const e=indexedDB.open(Fr,1);return new Promise((t,n)=>{e.addEventListener('error',()=>{n(e.error)}),e.addEventListener('upgradeneeded',()=>{const t=e.result;try{t.createObjectStore(Vr,{keyPath:xr})}catch(e){n(e)}}),e.addEventListener('success',async()=>{const n=e.result;n.objectStoreNames.contains(Vr)?t(n):(n.close(),await Wr(),t(await zr()))})})}async function Gr(e,t,n){const r=qr(e,!0).put({[xr]:t,value:n});return new Hr(r).toPromise()}async function Kr(e,t){const n=qr(e,!1).get(t),r=await new Hr(n).toPromise();return void 0===r?null:r.value}function $r(e,t){const n=qr(e,!0).delete(t);return new Hr(n).toPromise()}class Br{constructor(){this.type="LOCAL",this._shouldAllowMigration=!0,this.listeners={},this.localCache={},this.pollTimer=null,this.pendingWrites=0,this.receiver=null,this.sender=null,this.serviceWorkerReceiverAvailable=!1,this.activeServiceWorker=null,this._workerInitializationPromise=this.initializeServiceWorkerMessaging().then(()=>{},()=>{})}async _openDb(){return this.db||(this.db=await zr()),this.db}async _withRetries(e){let t=0;for(;;)try{const t=await this._openDb();return await e(t)}catch(e){if(t++>3)throw e;this.db&&(this.db.close(),this.db=void 0)}}async initializeServiceWorkerMessaging(){return Ur()?this.initializeReceiver():this.initializeSender()}async initializeReceiver(){this.receiver=Nr._getInstance(Ur()?self:null),this.receiver._subscribe("keyChanged",async(e,t)=>({keyProcessed:(await this._poll()).includes(t.key)})),this.receiver._subscribe("ping",async(e,t)=>["keyChanged"])}async initializeSender(){if(this.activeServiceWorker=await jr(),!this.activeServiceWorker)return;this.sender=new Dr(this.activeServiceWorker);const e=await this.sender._send("ping",{},800);e&&e[0]?.fulfilled&&e[0]?.value.includes("keyChanged")&&(this.serviceWorkerReceiverAvailable=!0)}async notifyServiceWorker(e){if(this.sender&&this.activeServiceWorker&&(navigator?.serviceWorker?.controller||null)===this.activeServiceWorker)try{await this.sender._send("keyChanged",{key:e},this.serviceWorkerReceiverAvailable?800:50)}catch{}}async _isAvailable(){try{if(!indexedDB)return!1;const e=await zr();return await Gr(e,vr,'1'),await $r(e,vr),!0}catch{}return!1}async _withPendingWrite(e){this.pendingWrites++;try{await e()}finally{this.pendingWrites--}}async _set(e,t){return this._withPendingWrite(async()=>(await this._withRetries(n=>Gr(n,e,t)),this.localCache[e]=t,this.notifyServiceWorker(e)))}async _get(e){const t=await this._withRetries(t=>Kr(t,e));return this.localCache[e]=t,t}async _remove(e){return this._withPendingWrite(async()=>(await this._withRetries(t=>$r(t,e)),delete this.localCache[e],this.notifyServiceWorker(e)))}async _poll(){const e=await this._withRetries(e=>{const t=qr(e,!1).getAll();return new Hr(t).toPromise()});if(!e)return[];if(0!==this.pendingWrites)return[];const t=[],n=new Set;if(0!==e.length)for(const{fbase_key:r,value:i}of e)n.add(r),JSON.stringify(this.localCache[r])!==JSON.stringify(i)&&(this.notifyListeners(r,i),t.push(r));for(const e of Object.keys(this.localCache))this.localCache[e]&&!n.has(e)&&(this.notifyListeners(e,null),t.push(e));return t}notifyListeners(e,t){this.localCache[e]=t;const n=this.listeners[e];if(n)for(const e of Array.from(n))e(t)}startPolling(){this.stopPolling(),this.pollTimer=setInterval(async()=>this._poll(),800)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}_addListener(e,t){0===Object.keys(this.listeners).length&&this.startPolling(),this.listeners[e]||(this.listeners[e]=new Set,this._get(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),0===this.listeners[e].size&&delete this.listeners[e]),0===Object.keys(this.listeners).length&&this.stopPolling()}}Br.type='LOCAL';const Jr=Br;
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Yr(e,t){return Y(e,"POST","/v2/accounts/mfaSignIn:start",J(e,t))}function Xr(e,t){return Y(e,"POST","/v2/accounts/mfaSignIn:finalize",J(e,t))}function Qr(e,t){return Y(e,"POST","/v2/accounts/mfaSignIn:finalize",J(e,t))}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const Zr=rt('rcb'),ei=new W(3e4,6e4);class ti{constructor(){this.hostLanguage='',this.counter=0,this.librarySeparatelyLoaded=!!Lr().grecaptcha?.render}load(e,t=""){return U(ni(t),e,"argument-error"),this.shouldResolveImmediately(t)&&re(Lr().grecaptcha)?Promise.resolve(Lr().grecaptcha):new Promise((n,r)=>{const i=Lr().setTimeout(()=>{r(N(e,"network-request-failed"))},ei.get());Lr()[Zr]=()=>{Lr().clearTimeout(i),delete Lr()[Zr];const s=Lr().grecaptcha;if(!s||!re(s))return void r(N(e,"internal-error"));const a=s.render;s.render=(e,t)=>{const n=a(e,t);return this.counter++,n},this.hostLanguage=t,n(s)};nt(`${tt.recaptchaV2Script}?${(0,f.querystring)({onload:Zr,render:'explicit',hl:t})}`).catch(()=>{clearTimeout(i),r(N(e,"internal-error"))})})}clearedOneInstance(){this.counter--}shouldResolveImmediately(e){return!!Lr().grecaptcha?.render&&(e===this.hostLanguage||this.counter>0||this.librarySeparatelyLoaded)}}function ni(e){return e.length<=6&&/^\s*[a-zA-Z0-9\-]*\s*$/.test(e)}class ri{async load(e){return new st(e)}clearedOneInstance(){}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const ii='recaptcha',si={theme:'light',type:'image'};class ai{constructor(e,t,n=Object.assign({},si)){this.parameters=n,this.type=ii,this.destroyed=!1,this.widgetId=null,this.tokenChangeListeners=new Set,this.renderPromise=null,this.recaptcha=null,this.auth=Ze(e),this.isInvisible='invisible'===this.parameters.size,U('undefined'!=typeof document,this.auth,"operation-not-supported-in-this-environment");const r='string'==typeof t?document.getElementById(t):t;U(r,this.auth,"argument-error"),this.container=r,this.parameters.callback=this.makeTokenCallback(this.parameters.callback),this._recaptchaLoader=this.auth.settings.appVerificationDisabledForTesting?new ri:new ti,this.validateStartingState()}async verify(){this.assertNotDestroyed();const e=await this.render(),t=this.getAssertedRecaptcha(),n=t.getResponse(e);return n||new Promise(n=>{const r=e=>{e&&(this.tokenChangeListeners.delete(r),n(e))};this.tokenChangeListeners.add(r),this.isInvisible&&t.execute(e)})}render(){try{this.assertNotDestroyed()}catch(e){return Promise.reject(e)}return this.renderPromise||(this.renderPromise=this.makeRenderPromise().catch(e=>{throw this.renderPromise=null,e})),this.renderPromise}_reset(){this.assertNotDestroyed(),null!==this.widgetId&&this.getAssertedRecaptcha().reset(this.widgetId)}clear(){this.assertNotDestroyed(),this.destroyed=!0,this._recaptchaLoader.clearedOneInstance(),this.isInvisible||this.container.childNodes.forEach(e=>{this.container.removeChild(e)})}validateStartingState(){U(!this.parameters.sitekey,this.auth,"argument-error"),U(this.isInvisible||!this.container.hasChildNodes(),this.auth,"argument-error"),U('undefined'!=typeof document,this.auth,"operation-not-supported-in-this-environment")}makeTokenCallback(e){return t=>{if(this.tokenChangeListeners.forEach(e=>e(t)),'function'==typeof e)e(t);else if('string'==typeof e){const n=Lr()[e];'function'==typeof n&&n(t)}}}assertNotDestroyed(){U(!this.destroyed,this.auth,"internal-error")}async makeRenderPromise(){if(await this.init(),!this.widgetId){let e=this.container;if(!this.isInvisible){const t=document.createElement('div');e.appendChild(t),e=t}this.widgetId=this.getAssertedRecaptcha().render(e,this.parameters)}return this.widgetId}async init(){U(x()&&!Ur(),this.auth,"internal-error"),await oi(),this.recaptcha=await this._recaptchaLoader.load(this.auth,this.auth.languageCode||void 0);const e=await ae(this.auth);U(e,this.auth,"internal-error"),this.parameters.sitekey=e}getAssertedRecaptcha(){return U(this.recaptcha,this.auth,"internal-error"),this.recaptcha}}function oi(){let e=null;return new Promise(t=>{'complete'!==document.readyState?(e=()=>t(),window.addEventListener('load',e)):t()}).catch(t=>{throw e&&window.removeEventListener('load',e),t})}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class ci{constructor(e,t){this.verificationId=e,this.onConfirmation=t}confirm(e){const t=Wt._fromVerification(this.verificationId,e);return this.onConfirmation(t)}}async function ui(e,t,n){if((0,p._isFirebaseServerApp)(e.app))return Promise.reject(D(e));const r=Ze(e),i=await hi(r,t,(0,f.getModularInstance)(n));return new ci(i,e=>In(r,e))}async function di(e,t,n){const r=(0,f.getModularInstance)(e);await fn(!1,r,"phone");const i=await hi(r.auth,t,(0,f.getModularInstance)(n));return new ci(i,e=>_n(r,e))}async function li(e,t,n){const r=(0,f.getModularInstance)(e);if((0,p._isFirebaseServerApp)(r.auth.app))return Promise.reject(D(r.auth));const i=await hi(r.auth,t,(0,f.getModularInstance)(n));return new ci(i,e=>yn(r,e))}async function hi(e,t,n){if(!e._getRecaptchaConfig())try{await ft(e)}catch(e){}try{let r;if(r='string'==typeof t?{phoneNumber:t}:t,'session'in r){const t=r.session;if('phoneNumber'in r){U("enroll"===t.type,e,"internal-error");const i={idToken:t.credential,phoneEnrollmentInfo:{phoneNumber:r.phoneNumber,clientType:"CLIENT_TYPE_WEB"}},s=pt(e,i,"mfaSmsEnrollment",async(e,t)=>{if(t.phoneEnrollmentInfo.captchaResponse===dt){U(n?.type===ii,e,"argument-error");return fr(e,await fi(e,t,n))}return fr(e,t)},"PHONE_PROVIDER");return(await s.catch(e=>Promise.reject(e))).phoneSessionInfo.sessionInfo}{U("signin"===t.type,e,"internal-error");const i=r.multiFactorHint?.uid||r.multiFactorUid;U(i,e,"missing-multi-factor-info");const s={mfaPendingCredential:t.credential,mfaEnrollmentId:i,phoneSignInInfo:{clientType:"CLIENT_TYPE_WEB"}},a=pt(e,s,"mfaSmsSignIn",async(e,t)=>{if(t.phoneSignInInfo.captchaResponse===dt){U(n?.type===ii,e,"argument-error");return Yr(e,await fi(e,t,n))}return Yr(e,t)},"PHONE_PROVIDER");return(await a.catch(e=>Promise.reject(e))).phoneResponseInfo.sessionInfo}}{const t={phoneNumber:r.phoneNumber,clientType:"CLIENT_TYPE_WEB"},i=pt(e,t,"sendVerificationCode",async(e,t)=>{if(t.captchaResponse===dt){U(n?.type===ii,e,"argument-error");return Ft(e,await fi(e,t,n))}return Ft(e,t)},"PHONE_PROVIDER");return(await i.catch(e=>Promise.reject(e))).sessionInfo}}finally{n?._reset()}}async function pi(e,t){const n=(0,f.getModularInstance)(e);if((0,p._isFirebaseServerApp)(n.auth.app))return Promise.reject(D(n.auth));await pn(n,t)}async function fi(e,t,n){U(n.type===ii,e,"argument-error");const r=await n.verify();U('string'==typeof r,e,"argument-error");const i=Object.assign({},t);if('phoneEnrollmentInfo'in i){const e=i.phoneEnrollmentInfo.phoneNumber,t=i.phoneEnrollmentInfo.captchaResponse,n=i.phoneEnrollmentInfo.clientType,s=i.phoneEnrollmentInfo.recaptchaVersion;return Object.assign(i,{phoneEnrollmentInfo:{phoneNumber:e,recaptchaToken:r,captchaResponse:t,clientType:n,recaptchaVersion:s}}),i}if('phoneSignInInfo'in i){const e=i.phoneSignInInfo.captchaResponse,t=i.phoneSignInInfo.clientType,n=i.phoneSignInInfo.recaptchaVersion;return Object.assign(i,{phoneSignInInfo:{recaptchaToken:r,captchaResponse:e,clientType:t,recaptchaVersion:n}}),i}return Object.assign(i,{recaptchaToken:r}),i}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class mi{constructor(e){this.providerId=mi.PROVIDER_ID,this.auth=Ze(e)}verifyPhoneNumber(e,t){return hi(this.auth,e,(0,f.getModularInstance)(t))}static credential(e,t){return Wt._fromVerification(e,t)}static credentialFromResult(e){const t=e;return mi.credentialFromTaggedObject(t)}static credentialFromError(e){return mi.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{phoneNumber:t,temporaryProof:n}=e;return t&&n?Wt._fromTokenResponse(t,n):null}}
/**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
function gi(e,t){return t?Ne(t):(U(e._popupRedirectResolver,e,"argument-error"),e._popupRedirectResolver)}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */mi.PROVIDER_ID="phone",mi.PHONE_SIGN_IN_METHOD="phone";class Ii extends Et{constructor(e){super("custom","custom"),this.params=e}_getIdTokenResponse(e){return Ut(e,this._buildIdpRequest())}_linkToIdToken(e,t){return Ut(e,this._buildIdpRequest(t))}_getReauthenticationResolver(e){return Ut(e,this._buildIdpRequest())}_buildIdpRequest(e){const t={requestUri:this.params.requestUri,sessionId:this.params.sessionId,postBody:this.params.postBody,tenantId:this.params.tenantId,pendingToken:this.params.pendingToken,returnSecureToken:!0,returnIdpCredential:!0};return e&&(t.idToken=e),t}}function _i(e){return gn(e.auth,new Ii(e),e.bypassAuthState)}function yi(e){const{auth:t,user:n}=e;return U(n,t,"internal-error"),mn(n,new Ii(e),e.bypassAuthState)}async function vi(e){const{auth:t,user:n}=e;return U(n,t,"internal-error"),pn(n,new Ii(e),e.bypassAuthState)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Ti{constructor(e,t,n,r,i=!1){this.auth=e,this.resolver=n,this.user=r,this.bypassAuthState=i,this.pendingPromise=null,this.eventManager=null,this.filter=Array.isArray(t)?t:[t]}execute(){return new Promise(async(e,t)=>{this.pendingPromise={resolve:e,reject:t};try{this.eventManager=await this.resolver._initialize(this.auth),await this.onExecution(),this.eventManager.registerConsumer(this)}catch(e){this.reject(e)}})}async onAuthEvent(e){const{urlResponse:t,sessionId:n,postBody:r,tenantId:i,error:s,type:a}=e;if(s)return void this.reject(s);const o={auth:this.auth,requestUri:t,sessionId:n,tenantId:i||void 0,postBody:r||void 0,user:this.user,bypassAuthState:this.bypassAuthState};try{this.resolve(await this.getIdpTask(a)(o))}catch(e){this.reject(e)}}onError(e){this.reject(e)}getIdpTask(e){switch(e){case"signInViaPopup":case"signInViaRedirect":return _i;case"linkViaPopup":case"linkViaRedirect":return vi;case"reauthViaPopup":case"reauthViaRedirect":return yi;default:R(this.auth,"internal-error")}}resolve(e){F(this.pendingPromise,'Pending promise was never set'),this.pendingPromise.resolve(e),this.unregisterAndCleanUp()}reject(e){F(this.pendingPromise,'Pending promise was never set'),this.pendingPromise.reject(e),this.unregisterAndCleanUp()}unregisterAndCleanUp(){this.eventManager&&this.eventManager.unregisterConsumer(this),this.pendingPromise=null,this.cleanUp()}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const Ei=new W(2e3,1e4);async function wi(e,t,n){if((0,p._isFirebaseServerApp)(e.app))return Promise.reject(N(e,"operation-not-supported-in-this-environment"));const r=Ze(e);L(e,t,Jt);const i=gi(r,n);return new Si(r,"signInViaPopup",t,i).executeNotNull()}async function bi(e,t,n){const r=(0,f.getModularInstance)(e);if((0,p._isFirebaseServerApp)(r.auth.app))return Promise.reject(N(r.auth,"operation-not-supported-in-this-environment"));L(r.auth,t,Jt);const i=gi(r.auth,n);return new Si(r.auth,"reauthViaPopup",t,i,r).executeNotNull()}async function Pi(e,t,n){const r=(0,f.getModularInstance)(e);L(r.auth,t,Jt);const i=gi(r.auth,n);return new Si(r.auth,"linkViaPopup",t,i,r).executeNotNull()}class Si extends Ti{constructor(e,t,n,r,i){super(e,t,r,i),this.provider=n,this.authWindow=null,this.pollId=null,Si.currentPopupAction&&Si.currentPopupAction.cancel(),Si.currentPopupAction=this}async executeNotNull(){const e=await this.execute();return U(e,this.auth,"internal-error"),e}async onExecution(){F(1===this.filter.length,'Popup operations only handle one event');const e=Cr();this.authWindow=await this.resolver._openPopup(this.auth,this.provider,this.filter[0],e),this.authWindow.associatedEvent=e,this.resolver._originValidation(this.auth).catch(e=>{this.reject(e)}),this.resolver._isIframeWebStorageSupported(this.auth,e=>{e||this.reject(N(this.auth,"web-storage-unsupported"))}),this.pollUserCancellation()}get eventId(){return this.authWindow?.associatedEvent||null}cancel(){this.reject(N(this.auth,"cancelled-popup-request"))}cleanUp(){this.authWindow&&this.authWindow.close(),this.pollId&&window.clearTimeout(this.pollId),this.authWindow=null,this.pollId=null,Si.currentPopupAction=null}pollUserCancellation(){const e=()=>{this.authWindow?.window?.closed?this.pollId=window.setTimeout(()=>{this.pollId=null,this.reject(N(this.auth,"popup-closed-by-user"))},8e3):this.pollId=window.setTimeout(e,Ei.get())};e()}}Si.currentPopupAction=null;
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
const Ai='pendingRedirect',Oi=new Map;class ki extends Ti{constructor(e,t,n=!1){super(e,["signInViaRedirect","linkViaRedirect","reauthViaRedirect","unknown"],t,void 0,n),this.eventId=null}async execute(){let e=Oi.get(this.auth._key());if(!e){try{const t=await Ri(this.resolver,this.auth)?await super.execute():null;e=()=>Promise.resolve(t)}catch(t){e=()=>Promise.reject(t)}Oi.set(this.auth._key(),e)}return this.bypassAuthState||Oi.set(this.auth._key(),()=>Promise.resolve(null)),e()}async onAuthEvent(e){if("signInViaRedirect"===e.type)return super.onAuthEvent(e);if("unknown"!==e.type){if(e.eventId){const t=await this.auth._redirectUserForId(e.eventId);if(t)return this.user=t,super.onAuthEvent(e);this.resolve(null)}}else this.resolve(null)}async onExecution(){}cleanUp(){}}async function Ri(e,t){const n=Mi(t),r=Li(e);if(!await r._isAvailable())return!1;const i='true'===await r._get(n);return await r._remove(n),i}async function Ni(e,t){return Li(e)._set(Mi(t),'true')}function Ci(){Oi.clear()}function Di(e,t){Oi.set(e._key(),t)}function Li(e){return Ne(e._redirectPersistence)}function Mi(e){return Le(Ai,e.config.apiKey,e.name)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Ui(e,t,n){return ji(e,t,n)}async function ji(e,t,n){if((0,p._isFirebaseServerApp)(e.app))return Promise.reject(D(e));const r=Ze(e);L(e,t,Jt),await r._initializationPromise;const i=gi(r,n);return await Ni(i,r),i._openRedirect(r,t,"signInViaRedirect")}function Fi(e,t,n){return Vi(e,t,n)}async function Vi(e,t,n){const r=(0,f.getModularInstance)(e);if(L(r.auth,t,Jt),(0,p._isFirebaseServerApp)(r.auth.app))return Promise.reject(D(r.auth));await r.auth._initializationPromise;const i=gi(r.auth,n);await Ni(i,r.auth);const s=await zi(r);return i._openRedirect(r.auth,t,"reauthViaRedirect",s)}function xi(e,t,n){return Hi(e,t,n)}async function Hi(e,t,n){const r=(0,f.getModularInstance)(e);L(r.auth,t,Jt),await r.auth._initializationPromise;const i=gi(r.auth,n);await fn(!1,r,t.providerId),await Ni(i,r.auth);const s=await zi(r);return i._openRedirect(r.auth,t,"linkViaRedirect",s)}async function qi(e,t){return await Ze(e)._initializationPromise,Wi(e,t,!1)}async function Wi(e,t,n=!1){if((0,p._isFirebaseServerApp)(e.app))return Promise.reject(D(e));const r=Ze(e),i=gi(r,t),s=new ki(r,i,n),a=await s.execute();return a&&!n&&(delete a.user._redirectEventId,await r._persistUserIfCurrent(a.user),await r._setRedirectUser(null,t)),a}async function zi(e){const t=Cr(`${e.uid}:::`);return e._redirectEventId=t,await e.auth._setRedirectUser(e),await e.auth._persistUserIfCurrent(e),t}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class Gi{constructor(e){this.auth=e,this.cachedEventUids=new Set,this.consumers=new Set,this.queuedRedirectEvent=null,this.hasHandledPotentialRedirect=!1,this.lastProcessedEventTime=Date.now()}registerConsumer(e){this.consumers.add(e),this.queuedRedirectEvent&&this.isEventForConsumer(this.queuedRedirectEvent,e)&&(this.sendToConsumer(this.queuedRedirectEvent,e),this.saveEventToCache(this.queuedRedirectEvent),this.queuedRedirectEvent=null)}unregisterConsumer(e){this.consumers.delete(e)}onEvent(e){if(this.hasEventBeenHandled(e))return!1;let t=!1;return this.consumers.forEach(n=>{this.isEventForConsumer(e,n)&&(t=!0,this.sendToConsumer(e,n),this.saveEventToCache(e))}),this.hasHandledPotentialRedirect||!Bi(e)||(this.hasHandledPotentialRedirect=!0,t||(this.queuedRedirectEvent=e,t=!0)),t}sendToConsumer(e,t){if(e.error&&!$i(e)){const n=e.error.code?.split('auth/')[1]||"internal-error";t.onError(N(this.auth,n))}else t.onAuthEvent(e)}isEventForConsumer(e,t){const n=null===t.eventId||!!e.eventId&&e.eventId===t.eventId;return t.filter.includes(e.type)&&n}hasEventBeenHandled(e){return Date.now()-this.lastProcessedEventTime>=6e5&&this.cachedEventUids.clear(),this.cachedEventUids.has(Ki(e))}saveEventToCache(e){this.cachedEventUids.add(Ki(e)),this.lastProcessedEventTime=Date.now()}}function Ki(e){return[e.type,e.eventId,e.sessionId,e.tenantId].filter(e=>e).join('-')}function $i({type:e,error:t}){return"unknown"===e&&"auth/no-auth-event"===t?.code}function Bi(e){switch(e.type){case"signInViaRedirect":case"linkViaRedirect":case"reauthViaRedirect":return!0;case"unknown":return $i(e);default:return!1}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function Ji(e,t={}){return Y(e,"GET","/v1/projects",t)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const Yi=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,Xi=/^https?/;async function Qi(e){if(e.config.emulator)return;const{authorizedDomains:t}=await Ji(e);for(const e of t)try{if(Zi(e))return}catch{}R(e,"unauthorized-domain")}function Zi(e){const t=V(),{protocol:n,hostname:r}=new URL(t);if(e.startsWith('chrome-extension://')){const i=new URL(e);return''===i.hostname&&''===r?'chrome-extension:'===n&&e.replace('chrome-extension://','')===t.replace('chrome-extension://',''):'chrome-extension:'===n&&i.hostname===r}if(!Xi.test(n))return!1;if(Yi.test(e))return r===e;const i=e.replace(/\./g,'\\.');return new RegExp('^(.+\\.'+i+'|'+i+')$','i').test(r)}
/**
   * @license
   * Copyright 2020 Google LLC.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const es=new W(3e4,6e4);function ts(){const e=Lr().___jsl;if(e?.H)for(const t of Object.keys(e.H))if(e.H[t].r=e.H[t].r||[],e.H[t].L=e.H[t].L||[],e.H[t].r=[...e.H[t].L],e.CP)for(let t=0;t<e.CP.length;t++)e.CP[t]=null}function ns(e){return new Promise((t,n)=>{function r(){ts(),gapi.load('gapi.iframes',{callback:()=>{t(gapi.iframes.getContext())},ontimeout:()=>{ts(),n(N(e,"network-request-failed"))},timeout:es.get()})}if(Lr().gapi?.iframes?.Iframe)t(gapi.iframes.getContext());else{if(!Lr().gapi?.load){const t=rt('iframefcb');return Lr()[t]=()=>{gapi.load?r():n(N(e,"network-request-failed"))},nt(`${tt.gapiScript}?onload=${t}`).catch(e=>n(e))}r()}}).catch(e=>{throw rs=null,e})}let rs=null;function is(e){return rs=rs||ns(e),rs}
/**
   * @license
   * Copyright 2020 Google LLC.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const ss=new W(5e3,15e3),as={style:{position:'absolute',top:'-100px',width:'1px',height:'1px'},'aria-hidden':'true',tabindex:'-1'},os=new Map([["identitytoolkit.googleapis.com",'p'],['staging-identitytoolkit.sandbox.googleapis.com','s'],['test-identitytoolkit.sandbox.googleapis.com','t']]);function cs(e){const t=e.config;U(t.authDomain,e,"auth-domain-config-required");const n=t.emulator?z(t,"emulator/auth/iframe"):`https://${e.config.authDomain}/__/auth/iframe`,r={apiKey:t.apiKey,appName:e.name,v:p.SDK_VERSION},i=os.get(e.config.apiHost);i&&(r.eid=i);const s=e._getFrameworks();return s.length&&(r.fw=s.join(',')),`${n}?${(0,f.querystring)(r).slice(1)}`}async function us(e){const t=await is(e),n=Lr().gapi;return U(n,e,"internal-error"),t.open({where:document.body,url:cs(e),messageHandlersFilter:n.iframes.CROSS_ORIGIN_IFRAMES_FILTER,attributes:as,dontclear:!0},t=>new Promise(async(n,r)=>{await t.restyle({setHideOnLeave:!1});const i=N(e,"network-request-failed"),s=Lr().setTimeout(()=>{r(i)},ss.get());function a(){Lr().clearTimeout(s),n(t)}t.ping(a).then(a,()=>{r(i)})}))}
/**
   * @license
   * Copyright 2020 Google LLC.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const ds={location:'yes',resizable:'yes',statusbar:'yes',toolbar:'no'};class ls{constructor(e){this.window=e,this.associatedEvent=null}close(){if(this.window)try{this.window.close()}catch(e){}}}function hs(e,t,n,r=500,i=600){const s=Math.max((window.screen.availHeight-i)/2,0).toString(),a=Math.max((window.screen.availWidth-r)/2,0).toString();let o='';const c=Object.assign({},ds,{width:r.toString(),height:i.toString(),top:s,left:a}),u=(0,f.getUA)().toLowerCase();n&&(o=Ve(u)?"_blank":n),je(u)&&(t=t||"http://localhost",c.scrollbars='yes');const d=Object.entries(c).reduce((e,[t,n])=>`${e}${t}=${n},`,'');if(Ke(u)&&'_self'!==o)return ps(t||'',o),new ls(null);const l=window.open(t||'',o,d);U(l,e,"popup-blocked");try{l.focus()}catch(e){}return new ls(l)}function ps(e,t){const n=document.createElement('a');n.href=e,n.target=t;const r=document.createEvent('MouseEvent');r.initMouseEvent('click',!0,!0,window,1,0,0,0,0,!1,!1,!1,!1,1,null),n.dispatchEvent(r)}
/**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const fs='__/auth/handler',ms='emulator/auth/handler',gs=encodeURIComponent('fac');async function Is(e,t,n,r,i,s){U(e.config.authDomain,e,"auth-domain-config-required"),U(e.config.apiKey,e,"invalid-api-key");const a={apiKey:e.config.apiKey,appName:e.name,authType:n,redirectUrl:r,v:p.SDK_VERSION,eventId:i};if(t instanceof Jt){t.setDefaultLanguage(e.languageCode),a.providerId=t.providerId||'',(0,f.isEmpty)(t.getCustomParameters())||(a.customParameters=JSON.stringify(t.getCustomParameters()));for(const[e,t]of Object.entries(s||{}))a[e]=t}if(t instanceof Yt){const e=t.getScopes().filter(e=>''!==e);e.length>0&&(a.scopes=e.join(','))}e.tenantId&&(a.tid=e.tenantId);const o=a;for(const e of Object.keys(o))void 0===o[e]&&delete o[e];const c=await e._getAppCheckToken(),u=c?`#${gs}=${encodeURIComponent(c)}`:'';return`${_s(e)}?${(0,f.querystring)(o).slice(1)}${u}`}function _s({config:e}){return e.emulator?z(e,ms):`https://${e.authDomain}/${fs}`}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const ys='webStorageSupport';const vs=class{constructor(){this.eventManagers={},this.iframes={},this.originValidationPromises={},this._redirectPersistence=kr,this._completeRedirectFn=Wi,this._overrideRedirectResult=Di}async _openPopup(e,t,n,r){F(this.eventManagers[e._key()]?.manager,'_initialize() not called before _openPopup()');return hs(e,await Is(e,t,n,V(),r),Cr())}async _openRedirect(e,t,n,r){await this._originValidation(e);return Mr(await Is(e,t,n,V(),r)),new Promise(()=>{})}_initialize(e){const t=e._key();if(this.eventManagers[t]){const{manager:e,promise:n}=this.eventManagers[t];return e?Promise.resolve(e):(F(n,'If manager is not set, promise should be'),n)}const n=this.initAndGetManager(e);return this.eventManagers[t]={promise:n},n.catch(()=>{delete this.eventManagers[t]}),n}async initAndGetManager(e){const t=await us(e),n=new Gi(e);return t.register('authEvent',t=>{U(t?.authEvent,e,"invalid-auth-event");return{status:n.onEvent(t.authEvent)?"ACK":"ERROR"}},gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER),this.eventManagers[e._key()]={manager:n},this.iframes[e._key()]=t,n}_isIframeWebStorageSupported(e,t){this.iframes[e._key()].send(ys,{type:ys},n=>{const r=n?.[0]?.[ys];void 0!==r&&t(!!r),R(e,"internal-error")},gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER)}_originValidation(e){const t=e._key();return this.originValidationPromises[t]||(this.originValidationPromises[t]=Qi(e)),this.originValidationPromises[t]}get _shouldInitProactively(){return $e()||Fe()||ze()}};class Ts{constructor(e){this.factorId=e}_process(e,t,n){switch(t.type){case"enroll":return this._finalizeEnroll(e,t.credential,n);case"signin":return this._finalizeSignIn(e,t.credential);default:return j('unexpected MultiFactorSessionType')}}}class Es extends Ts{constructor(e){super("phone"),this.credential=e}static _fromCredential(e){return new Es(e)}_finalizeEnroll(e,t,n){return mr(e,{idToken:t,displayName:n,phoneVerificationInfo:this.credential._makeVerificationRequest()})}_finalizeSignIn(e,t){return Xr(e,{mfaPendingCredential:t,phoneVerificationInfo:this.credential._makeVerificationRequest()})}}class ws{constructor(){}static assertion(e){return Es._fromCredential(e)}}ws.FACTOR_ID='phone';class bs{static assertionForEnrollment(e,t){return Ps._fromSecret(e,t)}static assertionForSignIn(e,t){return Ps._fromEnrollmentId(e,t)}static async generateSecret(e){const t=e;U(void 0!==t.user?.auth,"internal-error");const n=await(r=t.user.auth,i={idToken:t.credential,totpEnrollmentInfo:{}},Y(r,"POST","/v2/accounts/mfaEnrollment:start",J(r,i)));var r,i;return Ss._fromStartTotpMfaEnrollmentResponse(n,t.user.auth)}}bs.FACTOR_ID="totp";class Ps extends Ts{constructor(e,t,n){super("totp"),this.otp=e,this.enrollmentId=t,this.secret=n}static _fromSecret(e,t){return new Ps(t,void 0,e)}static _fromEnrollmentId(e,t){return new Ps(t,e)}async _finalizeEnroll(e,t,n){return U(void 0!==this.secret,e,"argument-error"),gr(e,{idToken:t,displayName:n,totpVerificationInfo:this.secret._makeTotpVerificationInfo(this.otp)})}async _finalizeSignIn(e,t){U(void 0!==this.enrollmentId&&void 0!==this.otp,e,"argument-error");const n={verificationCode:this.otp};return Qr(e,{mfaPendingCredential:t,mfaEnrollmentId:this.enrollmentId,totpVerificationInfo:n})}}class Ss{constructor(e,t,n,r,i,s,a){this.sessionInfo=s,this.auth=a,this.secretKey=e,this.hashingAlgorithm=t,this.codeLength=n,this.codeIntervalSeconds=r,this.enrollmentCompletionDeadline=i}static _fromStartTotpMfaEnrollmentResponse(e,t){return new Ss(e.totpSessionInfo.sharedSecretKey,e.totpSessionInfo.hashingAlgorithm,e.totpSessionInfo.verificationCodeLength,e.totpSessionInfo.periodSec,new Date(e.totpSessionInfo.finalizeEnrollmentTime).toUTCString(),e.totpSessionInfo.sessionInfo,t)}_makeTotpVerificationInfo(e){return{sessionInfo:this.sessionInfo,verificationCode:e}}generateQrCodeUrl(e,t){let n=!1;return(As(e)||As(t))&&(n=!0),n&&(As(e)&&(e=this.auth.currentUser?.email||'unknownuser'),As(t)&&(t=this.auth.name)),`otpauth://totp/${t}:${e}?secret=${this.secretKey}&issuer=${t}&algorithm=${this.hashingAlgorithm}&digits=${this.codeLength}`}}function As(e){return void 0===e||0===e?.length}var Os="@firebase/auth",ks="1.12.1";
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
class Rs{constructor(e){this.auth=e,this.internalListeners=new Map}getUid(){return this.assertAuthConfigured(),this.auth.currentUser?.uid||null}async getToken(e){if(this.assertAuthConfigured(),await this.auth._initializationPromise,!this.auth.currentUser)return null;return{accessToken:await this.auth.currentUser.getIdToken(e)}}addAuthTokenListener(e){if(this.assertAuthConfigured(),this.internalListeners.has(e))return;const t=this.auth.onIdTokenChanged(t=>{e(t?.stsTokenManager.accessToken||null)});this.internalListeners.set(e,t),this.updateProactiveRefresh()}removeAuthTokenListener(e){this.assertAuthConfigured();const t=this.internalListeners.get(e);t&&(this.internalListeners.delete(e),t(),this.updateProactiveRefresh())}assertAuthConfigured(){U(this.auth._initializationPromise,"dependent-sdk-initialized-before-auth")}updateProactiveRefresh(){this.internalListeners.size>0?this.auth._startProactiveRefresh():this.auth._stopProactiveRefresh()}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Ns(e){switch(e){case"Node":return'node';case"ReactNative":return'rn';case"Worker":return'webworker';case"Cordova":return'cordova';case"WebExtension":return'web-extension';default:return}}
/**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
const Cs=(0,f.getExperimentalSetting)('authIdTokenMaxAge')||300;let Ds=null;const Ls=e=>async t=>{const n=t&&await t.getIdTokenResult(),r=n&&((new Date).getTime()-Date.parse(n.issuedAtTime))/1e3;if(r&&r>Cs)return;const i=n?.token;Ds!==i&&(Ds=i,await fetch(e,{method:i?'POST':'DELETE',headers:i?{Authorization:`Bearer ${i}`}:{}}))};function Ms(e=(0,p.getApp)()){const t=(0,p._getProvider)(e,'auth');if(t.isInitialized())return t.getImmediate();const n=mt(e,{popupRedirectResolver:vs,persistence:[Jr,wr,kr]}),r=(0,f.getExperimentalSetting)('authTokenSyncURL');if(r&&'boolean'==typeof isSecureContext&&isSecureContext){const e=new URL(r,location.origin);if(location.origin===e.origin){const t=Ls(e.toString());ir(n,t,()=>t(n.currentUser)),rr(n,e=>t(e))}}const i=(0,f.getDefaultEmulatorHost)('auth');return i&&It(n,`http://${i}`),n}var Us,js;Us={loadJS:e=>new Promise((t,n)=>{const r=document.createElement('script');r.setAttribute('src',e),r.onload=t,r.onerror=e=>{const t=N("internal-error");t.customData=e,n(t)},r.type='text/javascript',r.charset='UTF-8',(document.getElementsByTagName('head')?.[0]??document).appendChild(r)}),gapiScript:'https://apis.google.com/js/api.js',recaptchaV2Script:'https://www.google.com/recaptcha/api.js',recaptchaEnterpriseScript:'https://www.google.com/recaptcha/enterprise.js?render='},tt=Us,js="Browser",(0,p._registerComponent)(new g.Component("auth",(e,{options:t})=>{const n=e.getProvider('app').getImmediate(),r=e.getProvider('heartbeat'),i=e.getProvider('app-check-internal'),{apiKey:s,authDomain:a}=n.options;U(s&&!s.includes(':'),"invalid-api-key",{appName:n.name});const o={apiKey:s,authDomain:a,clientPlatform:js,apiHost:"identitytoolkit.googleapis.com",tokenApiHost:"securetoken.googleapis.com",apiScheme:"https",sdkClientVersion:Be(js)},c=new Qe(n,r,i,o);return gt(c,t),c},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,t,n)=>{e.getProvider("auth-internal").initialize()})),(0,p._registerComponent)(new g.Component("auth-internal",e=>(e=>new Rs(e))(Ze(e.getProvider("auth").getImmediate())),"PRIVATE").setInstantiationMode("EXPLICIT")),(0,p.registerVersion)(Os,ks,Ns(js)),(0,p.registerVersion)(Os,ks,'esm2020')},1123,[18,1088,1090,1091,1089]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"PasswordPolicyMixin",{enumerable:!0,get:function(){return o}});var s=r(d[0]),t=r(d[1]);const o={_getPasswordPolicyInternal(){return null===this._tenantId?this._projectPasswordPolicy:this._tenantPasswordPolicies[this._tenantId]},async _updatePasswordPolicy(){const o=await(0,s.fetchPasswordPolicy)(this),n=new t.PasswordPolicyImpl(o);null===this._tenantId?this._projectPasswordPolicy=n:this._tenantPasswordPolicies[this._tenantId]=n},async _recachePasswordPolicy(){this._getPasswordPolicyInternal()&&await this._updatePasswordPolicy()},async validatePassword(s){this._getPasswordPolicyInternal()||await this._updatePasswordPolicy();const t=this._getPasswordPolicyInternal();if(1!==t.schemaVersion)throw new Error('auth/unsupported-password-policy-schema-version: The password policy received from the backend uses a schema version that is not supported by this version of the SDK.');return t.validatePassword(s)}}},1124,[1125,1126]);
__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),e.fetchPasswordPolicy=async function(t){try{const o='https://identitytoolkit.googleapis.com/v2/passwordPolicy?key=',s=t.app.options.apiKey,c=await fetch(`${o}${s}`);if(!c.ok){const t=await c.text();throw new Error(`firebase.auth().validatePassword(*) failed to fetch password policy from Firebase Console: ${c.statusText}. Details: ${t}`)}return await c.json()}catch(t){throw new Error(`firebase.auth().validatePassword(*) Failed to fetch password policy: ${t.message}`)}}},1125,[]);
__d(function(g,r,_i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return s}}),Object.defineProperty(e,"PasswordPolicyImpl",{enumerable:!0,get:function(){return t}});class t{constructor(t){const s=t.customStrengthOptions;this.customStrengthOptions={},this.customStrengthOptions.minPasswordLength=s.minPasswordLength??6,s.maxPasswordLength&&(this.customStrengthOptions.maxPasswordLength=s.maxPasswordLength),void 0!==s.containsLowercaseCharacter&&(this.customStrengthOptions.containsLowercaseLetter=s.containsLowercaseCharacter),void 0!==s.containsUppercaseCharacter&&(this.customStrengthOptions.containsUppercaseLetter=s.containsUppercaseCharacter),void 0!==s.containsNumericCharacter&&(this.customStrengthOptions.containsNumericCharacter=s.containsNumericCharacter),void 0!==s.containsNonAlphanumericCharacter&&(this.customStrengthOptions.containsNonAlphanumericCharacter=s.containsNonAlphanumericCharacter),this.enforcementState='ENFORCEMENT_STATE_UNSPECIFIED'===t.enforcementState?'OFF':t.enforcementState,this.allowedNonAlphanumericCharacters=t.allowedNonAlphanumericCharacters?.join('')??'',this.forceUpgradeOnSignin=t.forceUpgradeOnSignin??!1,this.schemaVersion=t.schemaVersion}validatePassword(t){const s={isValid:!0,passwordPolicy:this};return this.validatePasswordLengthOptions(t,s),this.validatePasswordCharacterOptions(t,s),s.isValid&&=s.meetsMinPasswordLength??!0,s.isValid&&=s.meetsMaxPasswordLength??!0,s.isValid&&=s.containsLowercaseLetter??!0,s.isValid&&=s.containsUppercaseLetter??!0,s.isValid&&=s.containsNumericCharacter??!0,s.isValid&&=s.containsNonAlphanumericCharacter??!0,s}validatePasswordLengthOptions(t,s){const n=this.customStrengthOptions.minPasswordLength,i=this.customStrengthOptions.maxPasswordLength;n&&(s.meetsMinPasswordLength=t.length>=n),i&&(s.meetsMaxPasswordLength=t.length<=i)}validatePasswordCharacterOptions(t,s){this.updatePasswordCharacterOptionsStatuses(s,!1,!1,!1,!1);for(let n=0;n<t.length;n++){const i=t.charAt(n);this.updatePasswordCharacterOptionsStatuses(s,i>='a'&&i<='z',i>='A'&&i<='Z',i>='0'&&i<='9',this.allowedNonAlphanumericCharacters.includes(i))}}updatePasswordCharacterOptionsStatuses(t,s,n,i,o){this.customStrengthOptions.containsLowercaseLetter&&(t.containsLowercaseLetter||=s),this.customStrengthOptions.containsUppercaseLetter&&(t.containsUppercaseLetter||=n),this.customStrengthOptions.containsNumericCharacter&&(t.containsNumericCharacter||=i),this.customStrengthOptions.containsNonAlphanumericCharacter&&(t.containsNonAlphanumericCharacter||=o)}}var s=t},1126,[]);