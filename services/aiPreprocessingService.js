class AIPreprocessingService {
  constructor() {
    // Check if OpenAI is available
    try {
      const { OpenAI } = require('openai');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.isAvailable = true;
      console.log('✅ AI Preprocessing Service initialized with OpenAI');
    } catch (error) {
      console.warn('⚠️ AI Preprocessing Service: OpenAI not available, running in fallback mode');
      this.openai = null;
      this.isAvailable = false;
    }
  }

  async preprocessDocument(text, documentAnalysis) {
    console.log('🤖 Starting AI document preprocessing...');
    
    // If OpenAI is not available, return basic preprocessing
    if (!this.isAvailable || !this.openai) {
      console.log('⚠️ AI preprocessing unavailable, returning basic preprocessing');
      return {
        sections: [{
          name: 'general',
          contacts: [],
          raw_text: text
        }],
        normalized_text: text,
        document_structure: 'basic'
      };
    }
    
    try {
      const prompt = `You are a document preprocessing expert. Analyze this call sheet text and:

1. IDENTIFY all contact sections (CREW, TALENT, CLIENTS, etc.)
2. NORMALIZE the text format for better extraction
3. EXTRACT and structure contact information
4. ADD missing context (roles, companies) based on document structure

Call Sheet Text:
${text}

Return a JSON response with:
{
  "sections": [
    {
      "name": "section_name",
      "contacts": [
        {
          "name": "Full Name",
          "email": "email@domain.com",
          "phone": "phone_number",
          "role": "inferred_role",
          "company": "inferred_company",
          "raw_line": "original_text_line"
        }
      ]
    }
  ],
  "normalized_text": "cleaned_and_structured_text",
  "document_structure": "analysis_of_document_format"
}`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert at analyzing call sheets and extracting contact information. Always return valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });

      const aiResult = JSON.parse(response.choices[0].message.content);
      console.log('🤖 AI preprocessing complete:', {
        sections: aiResult.sections?.length || 0,
        totalContacts: aiResult.sections?.reduce((sum, section) => sum + (section.contacts?.length || 0), 0) || 0
      });

      return aiResult;

    } catch (error) {
      console.error('❌ AI preprocessing failed:', error);
      throw new Error(`AI preprocessing failed: ${error.message}`);
    }
  }

  async enhanceExtractionResults(contacts, documentAnalysis) {
    console.log('🤖 Starting AI enhancement of extraction results...');
    
    // If OpenAI is not available, return original contacts
    if (!this.isAvailable || !this.openai) {
      console.log('⚠️ AI enhancement unavailable, returning original contacts');
      return contacts;
    }
    
    try {
      const prompt = `You are a contact information enhancement expert. Review these extracted contacts and:

1. IMPROVE role assignments based on context
2. INFER missing company information
3. VALIDATE and clean contact data
4. ADD confidence scores

Extracted Contacts:
${JSON.stringify(contacts, null, 2)}

Return enhanced contacts with improved role assignments and company information.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert at enhancing contact information. Always return valid JSON array of contacts."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const enhancedContacts = JSON.parse(response.choices[0].message.content);
      console.log('🤖 AI enhancement complete:', enhancedContacts.length, 'contacts enhanced');

      return enhancedContacts;

    } catch (error) {
      console.error('❌ AI enhancement failed:', error);
      // Return original contacts if enhancement fails
      return contacts;
    }
  }
}

module.exports = AIPreprocessingService;
