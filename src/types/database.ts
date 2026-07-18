export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============ Row Types (DB에서 읽어온 데이터) ============

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  team: string | null;
  referrer_name: string | null;
  referrer_phone: string | null;
  role: 'user' | 'admin';
  status: 'free' | 'paid';
  payment_date: string | null;
  mode: 'self' | 'guide';
  personality: 'logical' | 'emotional' | 'practical';
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  mode: 'self' | 'guide';
  giplet_type: string;
  case_type: string | null;
  case_step: number;
  case_context: Json | null;
  created_at: string;
  updated_at: string;
}

export interface AdminGiplet {
  id: string;
  giplet_key: string;
  name: string;
  description: string | null;
  tag: string | null;
  color_scheme: string;
  system_prompt: string;
  db_sources: string[];
  capability: string | null;
  case_key: string | null;
  initial_prompt: string;
  icon: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GuideStep {
  title: string;
  description?: string;
  collection_items_text?: string;
  linked_giplets?: string[];
}

export interface AdminCase {
  id: string;
  case_key: string;
  name: string;
  description: string | null;
  guide_steps: GuideStep[];
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminCaseStep {
  id: string;
  case_id: string;
  step_index: number;
  name: string;
  system_prompt: string;
  db_sources: string[];
  output_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type: 'text' | 'voice' | 'file' | 'image';
  created_at: string;
}

export interface MessageRawContent {
  id: string;
  message_id: string;
  raw_content: string;
  created_at: string;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export type ArchiveCategory = 'personal' | 'schedule' | 'contacts' | 'consultation' | 'lecture' | 'meeting' | 'etc';

export interface Archive {
  id: string;
  user_id: string;
  conversation_id: string | null;
  title: string;
  category: ArchiveCategory;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ArchiveAttachment {
  id: string;
  archive_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface AdminTemplate {
  id: string;
  title: string;
  category: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AdminBlock {
  id: string;
  title: string;
  category: string | null;
  content: string;
  // C-1 검색 필드 확장 (20260707000000 마이그레이션). 미적용 환경에선 컬럼이 없을 수 있어 optional.
  usage_context?: string | null;
  keywords?: string | null;
  tags?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSystemPrompt {
  id: string;
  content: string;
  giplet_type: string;
  updated_at: string;
  updated_by: string | null;
}

export interface AdminCalculation {
  id: string;
  title: string;
  content: string;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  description: string | null;
  category: string | null;
  // 한글 검색 키워드 (쉼표 구분). 영문 자료를 한글 질문으로 찾기 위한 렉시컬 검색 경로.
  keywords: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminProduct {
  id: string;
  product_number: string | null;
  name: string;
  price: number;
  score: number;
  description: string | null;
  keywords: string | null;
  symptoms: string | null;
  target_audience: string | null;
  recommended_situation: string | null;
  caution: string | null;
  category: string | null;
  sub_category: string | null;
  tags: string | null;
  aliases: string | null;
  usana_iq_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentStrategySetting {
  id: string;
  name: string;
  campaign_name: string | null;
  health_ratio: number;
  lifestyle_ratio: number;
  ai_tech_ratio: number;
  health_assets_ratio: number;
  community_ratio: number;
  recommendation_mode: 'balanced' | 'acquisition' | 'conversion' | 'shareable' | 'brand' | 'seasonal';
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentTopicRow {
  id: string;
  title: string;
  interest_category: 'health' | 'lifestyle' | 'ai_tech' | 'health_assets' | 'community';
  interest_subcategory: string;
  health_asset_codes: string[];
  audience_problem: string;
  search_intent: string;
  funnel_stage: 'awareness' | 'consideration' | 'conversion' | 'relationship';
  content_purpose: string;
  cta_level: 1 | 2 | 3 | 4;
  recommended_cta: string;
  evergreen_score: number;
  seasonality_score: number;
  shareability_score: number;
  conversion_score: number;
  recommended_channels: string[];
  recommended_formats: string[];
  status: 'draft' | 'review' | 'approved' | 'archived';
  metadata: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentPublication {
  id: string;
  topic_id: string;
  strategy_id: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  channel: string;
  content_format: string;
  status: 'planned' | 'drafting' | 'review' | 'published' | 'cancelled';
  recommendation_mode: 'balanced' | 'acquisition' | 'conversion' | 'shareable' | 'brand' | 'seasonal';
  recommendation_score: number | null;
  recommendation_reason: string | null;
  performance: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============ Insert/Update Types ============

export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;

export type ConversationInsert = {
  user_id: string;
  title?: string;
  mode?: 'self' | 'guide';
  giplet_type?: string;
  case_type?: string | null;
  case_step?: number;
  case_context?: Json | null;
};

export type AdminCaseInsert = {
  case_key: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  is_active?: boolean;
};

export type AdminCaseStepInsert = {
  case_id: string;
  step_index: number;
  name: string;
  system_prompt?: string;
  db_sources?: string[];
  output_key?: string | null;
};

export type MessageInsert = {
  conversation_id: string;
  role: Message['role'];
  content: string;
  message_type?: Message['message_type'];
};

export type ArchiveInsert = {
  user_id: string;
  conversation_id?: string | null;
  title: string;
  category?: ArchiveCategory;
  content: string;
};

export type ArchiveUpdate = Partial<Pick<Archive, 'title' | 'category' | 'content'>>;

export type AdminTemplateInsert = {
  title: string;
  category?: string | null;
  content: string;
};

export type AdminBlockInsert = {
  title: string;
  category?: string | null;
  content: string;
  usage_context?: string | null;
  keywords?: string | null;
  tags?: string | null;
};

export type AdminCalculationInsert = {
  title: string;
  content: string;
  category?: string | null;
};

export type AdminProductInsert = Omit<AdminProduct, 'id' | 'created_at' | 'updated_at'>;
export type AdminProductUpdate = Partial<AdminProductInsert>;

export type ProfileInsert = {
  id: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  team?: string | null;
  referrer_name?: string | null;
  referrer_phone?: string | null;
  role?: 'user' | 'admin';
  status?: 'free' | 'paid';
  payment_date?: string | null;
  mode?: 'self' | 'guide';
  personality?: 'logical' | 'emotional' | 'practical';
  onboarding_completed?: boolean;
  created_at?: string;
  updated_at?: string;
};

// ============ Supabase Database Type ============

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: ConversationInsert;
        Update: Partial<Pick<Conversation, 'title'>>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: MessageInsert;
        Update: Record<string, never>;
        Relationships: [];
      };
      message_raw_contents: {
        Row: MessageRawContent;
        Insert: Omit<MessageRawContent, 'id' | 'created_at'>;
        Update: Record<string, never>;
        Relationships: [];
      };
      message_attachments: {
        Row: MessageAttachment;
        Insert: Omit<MessageAttachment, 'id' | 'created_at'>;
        Update: Record<string, never>;
        Relationships: [];
      };
      archives: {
        Row: Archive;
        Insert: ArchiveInsert;
        Update: ArchiveUpdate;
        Relationships: [];
      };
      archive_attachments: {
        Row: ArchiveAttachment;
        Insert: Omit<ArchiveAttachment, 'id' | 'created_at'>;
        Update: Record<string, never>;
        Relationships: [];
      };
      admin_templates: {
        Row: AdminTemplate;
        Insert: AdminTemplateInsert;
        Update: Partial<AdminTemplateInsert>;
        Relationships: [];
      };
      admin_blocks: {
        Row: AdminBlock;
        Insert: AdminBlockInsert;
        Update: Partial<AdminBlockInsert>;
        Relationships: [];
      };
      admin_system_prompts: {
        Row: AdminSystemPrompt;
        Insert: { content: string; giplet_type?: string; updated_by?: string };
        Update: { content?: string; giplet_type?: string; updated_by?: string };
        Relationships: [];
      };
      admin_calculations: {
        Row: AdminCalculation;
        Insert: AdminCalculationInsert;
        Update: Partial<AdminCalculationInsert>;
        Relationships: [];
      };
      admin_files: {
        Row: AdminFile;
        Insert: Omit<AdminFile, 'id' | 'created_at'>;
        Update: Record<string, never>;
        Relationships: [];
      };
      admin_giplets: {
        Row: AdminGiplet;
        Insert: Omit<AdminGiplet, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<AdminGiplet, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      admin_cases: {
        Row: AdminCase;
        Insert: Omit<AdminCase, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<AdminCase, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      admin_products: {
        Row: AdminProduct;
        Insert: AdminProductInsert;
        Update: AdminProductUpdate;
        Relationships: [];
      };
      content_strategy_settings: {
        Row: ContentStrategySetting;
        Insert: Omit<ContentStrategySetting, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ContentStrategySetting, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      content_topics: {
        Row: ContentTopicRow;
        Insert: Omit<ContentTopicRow, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<ContentTopicRow, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      content_publications: {
        Row: ContentPublication;
        Insert: Omit<ContentPublication, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<ContentPublication, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
