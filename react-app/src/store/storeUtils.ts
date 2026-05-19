import { useStore as originalUseStore } from './index';

// Enhanced useStore with explicit setState and getState types
const useStoreUtils = {
  setState: (partial: any) => {
    // Access the internal setState method from Zustand
    const store = originalUseStore as any;
    if (typeof store.setState === 'function') {
      store.setState(partial);
    } else {
      console.error('setState is not available on the store');
    }
  },
  
  getState: () => {
    // Access the internal getState method from Zustand
    const store = originalUseStore as any;
    if (typeof store.getState === 'function') {
      return store.getState();
    } else {
      console.error('getState is not available on the store');
      return {};
    }
  }
};

export default useStoreUtils;