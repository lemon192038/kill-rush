import './styles.css';
import { App } from './ui/app';
import './ui/screens/home';
import './ui/screens/play';
import './ui/screens/collection';
import './ui/screens/profile';
import './ui/screens/settings';

const root = document.getElementById('app')!;
const app = new App(root);
void app.start().catch(e => { root.innerHTML = `<pre style="color:#f88;padding:20px">起動エラー: ${String(e)}</pre>`; console.error(e); });
(window as unknown as { __killrush: App }).__killrush = app;
