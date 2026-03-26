import type { PromptMessages } from '.';

export function highchartsConfigPrompt(params: {
  chartType: string;
  title: string;
  dataJson: string;
  contextPrompt?: string;
}): PromptMessages {
  const contextLine = params.contextPrompt
    ? `\n${params.contextPrompt}`
    : '';

  return [
    [
      'system',
      `Generate a Highcharts configuration object for the given data.${contextLine}
The chart type is ${params.chartType}.
The title is "${params.title}".
Return ONLY the JSON object.
Ensure it's a valid object that highcharts-react-official can consume.`,
    ],
    ['user', `Data: ${params.dataJson}`],
  ];
}
