import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ensurePersistentStorage } from '../data/persistence';
import { useSettings } from '../data/settingsStore';
import { ToastProvider } from '../design';
import { useApplyAppearance } from './appearance';
import { router } from './router';

export function App() {
  useApplyAppearance();

  useEffect(() => {
    void useSettings.getState().load();
    void ensurePersistentStorage();
  }, []);

  return (
    // reducedMotion="user": כל אנימציות Framer Motion מכבדות את prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </ToastProvider>
    </MotionConfig>
  );
}
