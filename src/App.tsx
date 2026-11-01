import { HashRouter, Route, Routes } from 'react-router-dom';
import { InstallBanner, UpdateBanner } from './components/Banners';
import { BottomNav } from './components/BottomNav';
import { History } from './screens/History';
import { Log } from './screens/Log';
import { Planning } from './screens/Planning';
import { Settings } from './screens/Settings';
import { Today } from './screens/Today';

// Hash routing: works on GitHub Pages and offline without server rewrites.
export function App() {
  return (
    <HashRouter>
      <div className="app">
        <UpdateBanner />
        <InstallBanner />
        <main>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/log" element={<Log />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/planning" element={<Planning />} />
            <Route path="*" element={<Today />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </HashRouter>
  );
}
