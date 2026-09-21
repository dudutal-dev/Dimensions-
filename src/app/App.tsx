import { MotionConfig } from 'framer-motion';
import { RouterProvider } from 'react-router-dom';
import { ToastProvider } from '../design';
import { useApplyAppearance } from './appearance';
import { router } from './router';

export function App() {
  useApplyAppearance();

  return (
    // reducedMotion="user": כל אנימציות Framer Motion מכבדות את prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </ToastProvider>
    </MotionConfig>
  );
}
