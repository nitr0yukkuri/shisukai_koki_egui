interface Window {
  jobuhan: {
    runtime: {
      electron: string;
      node: string;
      platform: string;
    };
    window: {
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<void>;
      close: () => Promise<void>;
    };
  };
}
