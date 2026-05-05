/**
 * SDK React UI
 *
 * React UI 组件层，使用 AgentSDK 的数据
 * 组件通过 props 接收数据，不依赖 Context
 *
 * @example
 * ```tsx
 * import { useAgentSDK } from '../sdk';
 * import { SubtitleDisplay, SessionInitToast } from '../sdk-react-ui';
 *
 * function App() {
 *   const { state } = useAgentSDK({ wsUrl: '...' });
 *
 *   return (
 *     <>
 *       <SessionInitToast
 *         isConnected={state.connectionStatus === 'connected'}
 *         isInitialized={state.isReady}
 *         isVADReady={state.isVADReady}
 *       />
 *       <SubtitleDisplay
 *         text={state.subtitleText}
 *         progress={state.subtitleProgress}
 *       />
 *     </>
 *   );
 * }
 * ```
 */

// Components
export * from './components';

// Hooks
export * from './hooks';

// Debug Components
export * from './debug';
