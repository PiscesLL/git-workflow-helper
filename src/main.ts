import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./style.css";

// 禁用 WebView 默认右键菜单
document.addEventListener("contextmenu", (e) => e.preventDefault());

const app = createApp(App);
app.use(createPinia());
app.mount("#app");
