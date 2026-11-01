import { useCallback, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { InstallBanner, UpdateBanner } from './components/Banners';
import { BottomNav } from './components/BottomNav';
import { Splash } from './components/Splash';
import { UndoProvider } from './components/Undo';
import { History } from './screens/History';
import { Log } from './screens/Log';
import { DayEditor } from './screens/planning/DayEditor';
import { PlanBuilder } from './screens/planning/PlanBuilder';
import { PlanningHome } from './screens/planning/PlanningHome';
import { Setup } from './screens/planning/Setup';
import { TypeDetail } from './screens/planning/TypeDetail';
import { Settings } from './screens/Settings';
import { Today } from './screens/Today';

// Hash routing: works on GitHub Pages and offline without server rewrites.
export function App() {
  // The app shell fades in as the splash fades out (a true cross-fade).
  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);
  return (
    <HashRouter>
      <UndoProvider>
        <Splash onLeave={reveal} />
        <div className={`app ${revealed ? 'app-in' : 'app-pre'}`}>
          <UpdateBanner />
          <InstallBanner />
          <main>
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/log" element={<Log />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/settings/planning" element={<PlanningHome />} />
              <Route path="/settings/planning/type/:typeId" element={<TypeDetail />} />
              <Route path="/settings/planning/plan/:planId" element={<PlanBuilder />} />
              <Route path="/settings/planning/plan/:planId/day/:dayId" element={<DayEditor />} />
              <Route path="*" element={<Today />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </UndoProvider>
    </HashRouter>
  );
}
