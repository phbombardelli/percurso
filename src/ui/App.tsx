import { useEffect } from 'react';
import { installUnloadGuard } from './actions/documentActions';
import { Canvas } from './canvas/Canvas';
import { DocumentPanel } from './inspector/DocumentPanel';
import { Sidebar } from './sidebar/Sidebar';
import { StatusBar } from './StatusBar';
import { Toolbar } from './toolbar/Toolbar';

export function App() {
  useEffect(installUnloadGuard, []);

  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        <Sidebar />
        <Canvas />
        <DocumentPanel />
      </div>
      <StatusBar />
    </div>
  );
}
