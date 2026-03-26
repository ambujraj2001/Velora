export type PromptMessages = [role: string, content: string][];

export { intentClassifierPrompt } from './intentClassifier';
export { sqlGeneratorPrompt } from './sqlGenerator';
export { chatResponsePrompt } from './chatResponse';
export { plannerPrompt } from './planner';
export { dashboardStrategyPrompt } from './dashboardStrategy';
export { dashboardSubtaskSqlPrompt } from './dashboardSubtaskSql';
export { highchartsConfigPrompt } from './highchartsConfig';
export { dashboardTitlePrompt } from './dashboardTitle';
export { dataSummaryPrompt } from './dataSummary';
export { conversationTitlePrompt } from './conversationTitle';
export { replannerPrompt } from './replanner';
