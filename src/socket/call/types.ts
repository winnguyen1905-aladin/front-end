// Export the call event handlers interface
export type { CallEventHandlers } from './listeners';
export type { CallEventData } from '../response/call';

// Re-export from handlers for convenience 
export type { ConsumersMap, ProducerState } from './handlers';

// For backward compatibility
export type ProducerResult = import('./handlers').ProducerState;
export interface ConsumeData {
  audioPidsToCreate: string[];
  videoPidsToCreate: (string | null)[];
  associatedUserNames: string[];
}
