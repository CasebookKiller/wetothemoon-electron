export interface PromptSection {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
}

export interface PromptTemplate {
  name: string;
  sections: PromptSection[];
  model: string;
}

export interface GeneratedPrompt {
  fullPrompt: string;
  selectedSections: PromptSection[];
}
