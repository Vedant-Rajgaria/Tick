/**
 * TICK - Manager Tasks Service
 */
(function() {
  'use strict';
  window.TICK_Tasks = {
    getAllTasks: () => window.TICK.getState().tasks,
    getCompletedTasks: () => window.TICK.getState().tasks.filter(t => t.status === 'COMPLETED')
  };
})();
