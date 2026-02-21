const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

/**
 * Get AI provider from settings
 */
async function getProvider() {
    const { rows } = await pool.query(
        `SELECT value FROM app_settings WHERE key = 'ai_provider'`
    );
    return rows[0]?.value || 'anthropic';
}

/**
 * Get API key from settings
 */
async function getApiKey() {
    const { rows } = await pool.query(
        `SELECT value FROM app_settings WHERE key = 'ai_api_key'`
    );
    if (rows.length === 0 || !rows[0].value) {
        throw new Error('AI API key not configured. Go to Settings → AI Configuration to set up.');
    }
    return rows[0].value;
}

/**
 * Get AI model from settings
 */
async function getModel() {
    const { rows } = await pool.query(
        `SELECT value FROM app_settings WHERE key = 'ai_model'`
    );
    return rows[0]?.value || 'claude-sonnet-4-20250514';
}

/**
 * Get custom system prompt from settings (if any)
 */
async function getCustomSystemPrompt() {
    const { rows } = await pool.query(
        `SELECT value FROM app_settings WHERE key = 'ai_custom_system_prompt'`
    );
    return rows[0]?.value || '';
}

/**
 * Call AI with the configured provider
 * @param {string} systemPrompt - system prompt
 * @param {Array} messages - [{role, content}]
 * @param {number} maxTokens - max tokens for response
 * @returns {Object} { text, tokensUsed }
 */
async function callAI(systemPrompt, messages, maxTokens = 4096) {
    const provider = await getProvider();
    const apiKey = await getApiKey();
    const model = await getModel();

    if (provider === 'openai') {
        const OpenAI = require('openai');
        const client = new OpenAI({ apiKey });
        const openAiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages,
        ];
        const response = await client.chat.completions.create({
            model,
            max_tokens: maxTokens,
            messages: openAiMessages,
        });
        return {
            text: response.choices[0]?.message?.content || 'No response',
            tokensUsed: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
        };
    } else if (provider === 'gemini') {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const genModel = genAI.getGenerativeModel({ model, systemInstruction: systemPrompt });
        // Convert messages to Gemini format
        const geminiHistory = messages.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
        const lastMessage = messages[messages.length - 1];
        const chat = genModel.startChat({ history: geminiHistory });
        const lastContent = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);
        const result = await chat.sendMessage(lastContent);
        const responseText = result.response.text();
        return {
            text: responseText || 'No response',
            tokensUsed: result.response.usageMetadata?.totalTokenCount || 0,
        };
    } else {
        // Default: Anthropic
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey });
        const response = await client.messages.create({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
        });
        return {
            text: response.content[0]?.text || 'No response',
            tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
        };
    }
}


/**
 * Build document-type-specific prompt
 */
function getDocumentPrompt(documentType) {
    const prompts = {
        'BILL_OF_LADING': `You are an import/export document specialist. Read this Bill of Lading and extract the information in JSON format:
{
  "shipper": "", "consignee": "", "notify_party": "",
  "vessel_name": "", "voyage_number": "",
  "port_of_loading": "", "port_of_discharge": "",
  "container_numbers": [], "seal_numbers": [],
  "description_of_goods": "", "gross_weight_kg": "",
  "number_of_packages": "", "bl_number": "",
  "date_of_issue": "", "freight_terms": ""
}
If any field is not found, write "N/A". After the JSON, list any anomalies or important notes.`,

        'COMMERCIAL_INVOICE': `You are an import/export document specialist. Read this Commercial Invoice and extract the information in JSON format:
{
  "invoice_number": "", "invoice_date": "",
  "seller": "", "buyer": "",
  "description_of_goods": "", "quantity": "",
  "unit_price": "", "total_amount": "", "currency": "",
  "payment_terms": "", "incoterms": "",
  "country_of_origin": "", "hs_code": ""
}
If any field is not found, write "N/A". After the JSON, verify logical consistency (e.g. quantity × unit_price = total_amount).`,

        'PACKING_LIST': `You are an import/export document specialist. Read this Packing List and extract the information in JSON format:
{
  "shipper": "", "consignee": "",
  "invoice_ref": "", "container_numbers": [],
  "items": [{"description": "", "quantity": "", "net_weight_kg": "", "gross_weight_kg": "", "cbm": ""}],
  "total_packages": "", "total_net_weight_kg": "", "total_gross_weight_kg": "", "total_cbm": ""
}
After the JSON, verify logical consistency (total weight, total CBM).`,

        'CUSTOMS_DECLARATION': `You are an import/export document specialist. Read this Customs Declaration and extract the information in JSON format:
{
  "declaration_number": "", "declaration_date": "",
  "exporter": "", "importer": "",
  "hs_code": "", "description_of_goods": "",
  "quantity": "", "unit": "",
  "declared_value": "", "currency": "",
  "customs_office": "", "procedure_code": "",
  "country_of_origin": "", "country_of_destination": ""
}
After the JSON, list any important notes or concerns.`,

        'PHYTOSANITARY': `You are a fruit export/import specialist. Read this Phytosanitary Certificate and extract:
{
  "certificate_number": "", "date_of_issue": "",
  "exporter": "", "importer": "",
  "place_of_origin": "", "port_of_entry": "",
  "description_of_goods": "", "botanical_name": "",
  "quantity": "", "treatment_method": "",
  "treatment_date": "", "chemicals_used": "",
  "validity_period": ""
}
IMPORTANT for fruit exports: Check whether the phytosanitary certificate is still valid and whether the treatment method meets the importing country's requirements.`,

        'CERTIFICATE_OF_ORIGIN': `You are an import/export document specialist. Read this Certificate of Origin (C/O) and extract:
{
  "co_number": "", "co_form": "",
  "date_of_issue": "", "exporter": "",
  "consignee": "", "country_of_origin": "",
  "country_of_destination": "",
  "description_of_goods": "", "hs_code": "",
  "quantity": "", "fob_value": "",
  "issuing_authority": ""
}
After the JSON, verify: Is the C/O form appropriate for the FTA between the two countries? Does the HS code match the goods?`,
    };

    return prompts[documentType] || `You are an import/export document specialist. Read this document and extract all important information in JSON format. List any anomalies or important notes.`;
}

// ===== ANALYZE SINGLE DOCUMENT =====
router.post('/analyze', async (req, res) => {
    try {
        const { documentId } = req.body;

        if (!documentId) {
            return res.status(400).json({ error: 'documentId is required' });
        }

        // Get document info
        const { rows: docs } = await pool.query(
            `SELECT * FROM documents WHERE id = $1`,
            [documentId]
        );

        if (docs.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const doc = docs[0];
        const docPrompt = getDocumentPrompt(doc.document_type);

        // Try to read the actual file
        let fileContent = null;
        try {
            const filePath = doc.file_path;
            const fileBuffer = await fs.readFile(filePath);
            const mimeType = doc.file_type || 'application/pdf';

            if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
                // For binary files, encode as base64 and include metadata
                fileContent = `[File: ${doc.file_name} (${mimeType}, ${fileBuffer.length} bytes, base64-encoded)]\n` +
                    fileBuffer.toString('base64').substring(0, 5000) + '...';
            } else {
                // Text-based files
                fileContent = fileBuffer.toString('utf-8');
            }
        } catch (fileErr) {
            // If file doesn't exist, use document metadata for analysis
            fileContent = null;
        }

        // Build the message for AI
        let userMessage;
        if (fileContent) {
            userMessage = `${docPrompt}\n\nDocument content:\n${fileContent}`;
        } else {
            // Fallback: analyze based on document metadata
            userMessage = `${docPrompt}\n\nNote: The actual file could not be read. Please analyze based on this metadata:\n` +
                `- Document Type: ${doc.document_type}\n` +
                `- Document Number: ${doc.document_number || 'N/A'}\n` +
                `- File Name: ${doc.file_name}\n` +
                `- Status: ${doc.status}\n` +
                `Please provide a template analysis for this type of document with typical fields and checks.`;
        }

        // Use multi-provider callAI
        const aiResult = await callAI(
            'You are an import/export document specialist with expertise in fruit export logistics.',
            [{ role: 'user', content: userMessage }],
            4096
        );

        const analysisText = aiResult.text;
        const tokensUsed = aiResult.tokensUsed;

        // Parse JSON from response if possible
        let structuredResult = null;
        const jsonMatch = analysisText.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
            try {
                structuredResult = JSON.parse(jsonMatch[0]);
            } catch (e) {
                // Not valid JSON, that's okay
            }
        }

        // Save result
        const model = await getModel();
        const { rows: results } = await pool.query(
            `INSERT INTO ai_analysis_results 
             (document_id, shipment_id, analysis_type, result, model, tokens_used)
             VALUES ($1, $2, 'EXTRACTION', $3, $4, $5)
             RETURNING *`,
            [documentId, doc.shipment_id, JSON.stringify({ text: analysisText, structured: structuredResult }), model, tokensUsed]
        );

        console.log(`🤖 AI analyzed document: ${doc.file_name} (${tokensUsed} tokens)`);

        res.json({
            success: true,
            analysis: results[0],
            text: analysisText,
            structured: structuredResult,
            tokensUsed,
        });
    } catch (error) {
        console.error('AI analysis error:', error);
        res.status(500).json({ error: error.message || 'AI analysis failed' });
    }
});

// ===== GET ANALYSIS RESULTS FOR SHIPMENT =====
router.get('/results/:shipmentId', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT ar.*, d.file_name, d.document_type 
             FROM ai_analysis_results ar
             LEFT JOIN documents d ON ar.document_id = d.id
             WHERE ar.shipment_id = $1
             ORDER BY ar.created_at DESC`,
            [req.params.shipmentId]
        );
        res.json({ results: rows });
    } catch (error) {
        console.error('Error fetching AI results:', error);
        res.json({ results: [] });
    }
});

// ===== CROSS-CHECK DOCUMENTS IN SHIPMENT =====
router.post('/cross-check/:shipmentId', async (req, res) => {
    try {
        const { shipmentId } = req.params;

        // Get all analysis results for this shipment
        const { rows: analyses } = await pool.query(
            `SELECT ar.result, d.document_type, d.file_name
             FROM ai_analysis_results ar
             JOIN documents d ON ar.document_id = d.id
             WHERE ar.shipment_id = $1 AND ar.analysis_type = 'EXTRACTION'
             ORDER BY ar.created_at DESC`,
            [shipmentId]
        );

        if (analyses.length < 2) {
            return res.status(400).json({
                error: 'At least 2 analyzed documents are required for cross-checking. Please analyze individual documents first.'
            });
        }

        // Build cross-check prompt
        let context = 'Below are the extraction results from documents within the same shipment:\n\n';
        for (const a of analyses) {
            const result = typeof a.result === 'string' ? JSON.parse(a.result) : a.result;
            context += `=== ${a.document_type} (${a.file_name}) ===\n`;
            context += JSON.stringify(result.structured || result.text, null, 2);
            context += '\n\n';
        }

        const crossCheckPrompt = `${context}

You are an export document verification specialist for a fruit export company. Cross-check all the documents above and report:

1. **MATCHING DATA**: List information that is consistent across documents (product names, quantities, weights, container numbers, etc.)
2. **DISCREPANCIES**: List any discrepancies in: container numbers, weights, amounts, goods description, buyer/seller, etc.
3. **MISSING INFORMATION**: Important information present in one document but missing from another.
4. **RISK ASSESSMENT**: Overall risk rating (HIGH / MEDIUM / LOW) with explanation.
5. **RECOMMENDATIONS**: Actions that need to be taken immediately.

Provide a clear, well-formatted response.`;

        // Use multi-provider callAI instead of hardcoded Anthropic
        const aiResult = await callAI(
            'You are an expert document verification specialist for import/export logistics.',
            [{ role: 'user', content: crossCheckPrompt }],
            4096
        );

        const crossCheckText = aiResult.text;
        const tokensUsed = aiResult.tokensUsed;

        // Save cross-check result
        const model = await getModel();
        await pool.query(
            `INSERT INTO ai_analysis_results 
             (shipment_id, analysis_type, result, model, tokens_used)
             VALUES ($1, 'CROSS_CHECK', $2, $3, $4)`,
            [shipmentId, JSON.stringify({ text: crossCheckText }), model, tokensUsed]
        );

        res.json({
            success: true,
            crossCheck: crossCheckText,
            documentsCompared: analyses.length,
            tokensUsed,
        });
    } catch (error) {
        console.error('Cross-check error:', error);
        res.status(500).json({ error: error.message || 'Cross-check failed' });
    }
});

// ===== HOLISTIC AI AUDIT — Extract all + Cross-check in one call =====
router.post('/audit/:shipmentId', async (req, res) => {
    try {
        const { shipmentId } = req.params;

        // 1. Get shipment info
        const { rows: shipmentRows } = await pool.query(
            `SELECT s.*, c.company_name as customer_name, f.company_name as forwarder_name
             FROM shipments s
             LEFT JOIN customers c ON s.customer_id = c.id
             LEFT JOIN forwarders f ON s.forwarder_id = f.id
             WHERE s.id = $1`,
            [shipmentId]
        );

        if (shipmentRows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        const shipment = shipmentRows[0];

        // 2. Get all non-deleted documents for this shipment
        const { rows: docs } = await pool.query(
            `SELECT * FROM documents WHERE shipment_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
            [shipmentId]
        );

        if (docs.length === 0) {
            return res.status(400).json({
                error: 'No documents found for this shipment. Please upload documents first.'
            });
        }

        // 3. STEP 1 — Extract each document in parallel
        console.log(`🔍 AI Audit: Starting extraction for ${docs.length} documents...`);

        const extractionPromises = docs.map(async (doc) => {
            // Check if extraction already exists
            const { rows: existing } = await pool.query(
                `SELECT result FROM ai_analysis_results 
                 WHERE document_id = $1 AND analysis_type = 'EXTRACTION'
                 ORDER BY created_at DESC LIMIT 1`,
                [doc.id]
            );

            if (existing.length > 0) {
                const result = typeof existing[0].result === 'string'
                    ? JSON.parse(existing[0].result) : existing[0].result;
                return {
                    document_type: doc.document_type,
                    file_name: doc.file_name,
                    extracted: result.structured || result.text || result,
                    cached: true,
                };
            }

            // Run extraction
            const docPrompt = getDocumentPrompt(doc.document_type);
            let userMessage;

            try {
                const filePath = doc.file_path;
                const fileBuffer = await fs.readFile(filePath);
                const mimeType = doc.file_type || 'application/pdf';

                if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
                    const content = `[File: ${doc.file_name} (${mimeType}, ${fileBuffer.length} bytes)]\\n` +
                        fileBuffer.toString('base64').substring(0, 5000) + '...';
                    userMessage = `${docPrompt}\\n\\nDocument content:\\n${content}`;
                } else {
                    userMessage = `${docPrompt}\\n\\nDocument content:\\n${fileBuffer.toString('utf-8')}`;
                }
            } catch (fileErr) {
                userMessage = `${docPrompt}\\n\\nNote: The actual file could not be read. Please analyze based on this metadata:\\n` +
                    `- Document Type: ${doc.document_type}\\n` +
                    `- Document Number: ${doc.document_number || 'N/A'}\\n` +
                    `- File Name: ${doc.file_name}\\n` +
                    `Please provide a template analysis for this type of document.`;
            }

            const aiResult = await callAI(
                'You are an import/export document specialist with expertise in fruit export logistics.',
                [{ role: 'user', content: userMessage }],
                2048
            );

            // Parse JSON from response
            let structured = null;
            const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try { structured = JSON.parse(jsonMatch[0]); } catch (e) { /* skip */ }
            }

            // Save extraction result
            const model = await getModel();
            await pool.query(
                `INSERT INTO ai_analysis_results 
                 (document_id, shipment_id, analysis_type, result, model, tokens_used)
                 VALUES ($1, $2, 'EXTRACTION', $3, $4, $5)`,
                [doc.id, shipmentId, JSON.stringify({ text: aiResult.text, structured }), model, aiResult.tokensUsed]
            );

            return {
                document_type: doc.document_type,
                file_name: doc.file_name,
                extracted: structured || aiResult.text,
                cached: false,
            };
        });

        const extractions = await Promise.all(extractionPromises);
        console.log(`🔍 AI Audit: Extraction complete. ${extractions.filter(e => !e.cached).length} new, ${extractions.filter(e => e.cached).length} cached.`);

        // 4. STEP 2 — Cross-document Audit with the holistic prompt
        let extractionContext = '';
        for (const ext of extractions) {
            extractionContext += `\n=== ${ext.document_type} (${ext.file_name}) ===\n`;
            extractionContext += typeof ext.extracted === 'object'
                ? JSON.stringify(ext.extracted, null, 2)
                : ext.extracted;
            extractionContext += '\n';
        }

        const shipmentContext = `
SHIPMENT INFORMATION:
- Shipment Number: ${shipment.shipment_number}
- Type: ${shipment.type}
- Status: ${shipment.status}
- Origin: ${shipment.origin_port || shipment.origin_country || 'N/A'}
- Destination: ${shipment.destination_port || shipment.destination_country || 'N/A'}
- Customer: ${shipment.customer_name || 'N/A'}
- Forwarder: ${shipment.forwarder_name || 'N/A'}
- Cargo: ${shipment.cargo_description || 'N/A'}
- Weight: ${shipment.cargo_weight_kg || 'N/A'} kg
- Containers: ${shipment.container_count || 'N/A'} × ${shipment.container_type || 'N/A'}
- Incoterm: ${shipment.incoterm || 'N/A'}
- ETD: ${shipment.etd || 'N/A'}
- ETA: ${shipment.eta || 'N/A'}

DOCUMENTS AVAILABLE (${docs.length} total):
${docs.map(d => `- ${d.document_type}: ${d.file_name}`).join('\n')}
`;

        const auditSystemPrompt = `You are a Senior Documentation Officer at a fruit export company (Ago Fruit, Vietnam).
You have 15+ years of experience in import/export documentation compliance.

YOUR JOB: Audit ALL documents of a single shipment to ensure they are complete, 
consistent, and ready for customs clearance. You are the LAST LINE OF DEFENSE before 
documents are submitted to customs — any error you miss will cause delays, fines, 
or shipment rejection.

AUDIT RULES:

RULE 1 — DOCUMENT COMPLETENESS CHECK
Required documents for EVERY shipment:
  - Commercial Invoice (CI)
  - Packing List (PL)
  - Bill of Lading (B/L) or Air Waybill (AWB)
Additional for fruit exports:
  - Phytosanitary Certificate (PC) — MANDATORY for all fresh produce
  - Certificate of Origin (C/O) — required if buyer requests FTA preferential rate
  - Fumigation Certificate — required by certain countries (Japan, Korea, Australia)
List which required documents are PRESENT and which are MISSING.

RULE 2 — CROSS-FIELD CONSISTENCY
Compare these fields ACROSS ALL documents. They MUST match:
  • Shipper/Exporter name → must be identical on CI, PL, B/L, C/O, PC
  • Consignee/Buyer name → must be identical on CI, PL, B/L
  • Goods description → must be consistent (same product name, same HS code)
  • Quantity (packages/cartons) → PL total must = CI quantity must = B/L quantity
  • Gross weight (kg) → PL total must = B/L weight (tolerance: ±2%)
  • Net weight (kg) → PL total must ≈ CI net weight
  • Total value (USD/EUR) → CI total must = quantity × unit price (exact math)
  • Container number(s) → B/L containers must = PL containers
  • Seal number(s) → B/L seals must appear on PL
  • Port of Loading → must be consistent across B/L, C/O, PC
  • Port of Discharge → must be consistent across all docs
  • Country of Origin → C/O origin must match PC place of origin
  • Incoterms → CI incoterms must match the shipment terms
  • HS Code → CI HS code must match C/O HS code

RULE 3 — DOCUMENT-SPECIFIC VALIDATION
  Commercial Invoice: quantity × unit_price = line total (EXACT), sum of line totals = invoice total
  Packing List: total cartons = sum of items, weights add up, CBM fits container
  Bill of Lading: SHIPPED ON BOARD date present, B/L type specified, freight terms match incoterms
  Certificate of Origin: C/O form matches FTA, HS code matches CI
  Phytosanitary Certificate: still valid, treatment method specified, botanical name correct

RULE 4 — DATE LOGIC
  - Invoice date ≤ B/L date
  - PC issue date ≤ B/L date
  - B/L date ≈ ETD

RULE 5 — RED FLAGS (auto-HIGH risk)
  - Shipper name on docs ≠ company name in system
  - Weight discrepancy > 5% between any two documents
  - Container number mismatch between B/L and PL
  - Missing phytosanitary cert for fresh produce
  - Invoice total calculation error
  - B/L shows "RECEIVED FOR SHIPMENT" instead of "SHIPPED ON BOARD"

OUTPUT FORMAT — You MUST output EXACTLY this JSON structure inside a \`\`\`json code block:

{
  "audit_status": "PASS" or "WARNING" or "FAIL",
  "risk_level": "LOW" or "MEDIUM" or "HIGH" or "CRITICAL",
  "documents_checked": [
    {"type": "COMMERCIAL_INVOICE", "file": "filename.pdf", "status": "OK" or "WARNING" or "ERROR", "issues": ["issue description"]}
  ],
  "missing_documents": ["document types that are required but not uploaded"],
  "cross_check_results": [
    {
      "field": "Field Name",
      "values": {"DOC_TYPE_1": "value1", "DOC_TYPE_2": "value2"},
      "status": "MATCH" or "MISMATCH" or "WITHIN_TOLERANCE",
      "note": "explanation"
    }
  ],
  "errors": [
    {"severity": "HIGH", "document": "DOC_TYPE", "field": "field_name", "issue": "description", "action": "what to do"}
  ],
  "warnings": [
    {"severity": "MEDIUM", "document": "DOC_TYPE", "field": "field_name", "issue": "description", "action": "what to do"}
  ],
  "summary": "Overall summary in 1-2 sentences",
  "recommended_actions": ["Action 1", "Action 2"]
}

IMPORTANT:
- Be STRICT. In real customs, even small errors cause delays.
- Do NOT say "everything looks fine" unless you have verified EVERY rule.
- If a field is missing from extracted data, flag it as "UNABLE TO VERIFY".
- Always provide specific numbers and comparisons.
- Your output MUST be valid JSON wrapped in a \`\`\`json code block.`;

        const auditUserMessage = `${shipmentContext}\n\nEXTRACTED DATA FROM ALL DOCUMENTS:\n${extractionContext}\n\nPlease perform a FULL AUDIT following all rules above. Output ONLY the JSON result.`;

        const auditResult = await callAI(
            auditSystemPrompt,
            [{ role: 'user', content: auditUserMessage }],
            4096
        );

        // Parse the structured result
        let auditJson = null;
        const auditJsonMatch = auditResult.text.match(/```json\s*([\s\S]*?)\s*```/);
        if (auditJsonMatch) {
            try {
                auditJson = JSON.parse(auditJsonMatch[1]);
            } catch (e) {
                // Try to find any JSON object in the response
                const fallbackMatch = auditResult.text.match(/\{[\s\S]*\}/);
                if (fallbackMatch) {
                    try { auditJson = JSON.parse(fallbackMatch[0]); } catch (e2) { /* skip */ }
                }
            }
        } else {
            // Fallback: try to find any JSON object
            const fallbackMatch = auditResult.text.match(/\{[\s\S]*\}/);
            if (fallbackMatch) {
                try { auditJson = JSON.parse(fallbackMatch[0]); } catch (e) { /* skip */ }
            }
        }

        // 5. Save audit result
        const model = await getModel();
        await pool.query(
            `INSERT INTO ai_analysis_results 
             (shipment_id, analysis_type, result, model, tokens_used)
             VALUES ($1, 'AUDIT', $2, $3, $4)`,
            [shipmentId, JSON.stringify({
                text: auditResult.text,
                structured: auditJson,
                extractions: extractions.map(e => ({ type: e.document_type, file: e.file_name })),
            }), model, auditResult.tokensUsed]
        );

        // 6. Auto-update document status if PASS
        if (auditJson && auditJson.audit_status === 'PASS') {
            await pool.query(
                `UPDATE documents SET status = 'CHECKED', updated_at = NOW()
                 WHERE shipment_id = $1 AND deleted_at IS NULL AND status NOT IN ('APPROVED', 'CHECKED')`,
                [shipmentId]
            );
            console.log(`✅ AI Audit PASS: All docs for ${shipment.shipment_number} marked as CHECKED`);
        }

        console.log(`🔍 AI Audit complete for ${shipment.shipment_number}: ${auditJson?.audit_status || 'NO_STATUS'} (${auditResult.tokensUsed} tokens)`);

        res.json({
            success: true,
            shipment_number: shipment.shipment_number,
            audit_status: auditJson?.audit_status || 'UNKNOWN',
            risk_level: auditJson?.risk_level || 'UNKNOWN',
            audit: auditJson,
            raw_text: auditResult.text,
            documents_count: docs.length,
            extractions_cached: extractions.filter(e => e.cached).length,
            extractions_new: extractions.filter(e => !e.cached).length,
            tokensUsed: auditResult.tokensUsed,
        });
    } catch (error) {
        console.error('AI Audit error:', error);
        res.status(500).json({ error: error.message || 'AI Audit failed' });
    }
});

// ===== CHAT: GET HISTORY =====
router.get('/chat/:shipmentId', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM ai_chat_messages 
             WHERE shipment_id = $1 
             ORDER BY created_at ASC`,
            [req.params.shipmentId]
        );
        res.json({ messages: rows });
    } catch (error) {
        console.error('Error fetching chat:', error);
        res.json({ messages: [] });
    }
});

// ===== CHAT: SEND MESSAGE =====
router.post('/chat/:shipmentId', async (req, res) => {
    try {
        const { shipmentId } = req.params;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Save user message
        await pool.query(
            `INSERT INTO ai_chat_messages (shipment_id, role, content) VALUES ($1, 'user', $2)`,
            [shipmentId, message]
        );

        // Get shipment context
        const { rows: shipments } = await pool.query(
            `SELECT s.*, b.booking_number, b.vessel_flight, b.origin_port, b.destination_port,
                    b.container_type, b.container_count, b.freight_rate_usd,
                    f.company_name as forwarder_name
             FROM shipments s
             LEFT JOIN bookings b ON b.shipment_id = s.id
             LEFT JOIN forwarders f ON b.forwarder_id = f.id
             WHERE s.id = $1`,
            [shipmentId]
        );

        // Get document analysis results
        const { rows: analyses } = await pool.query(
            `SELECT ar.result, d.document_type, d.file_name
             FROM ai_analysis_results ar
             JOIN documents d ON ar.document_id = d.id
             WHERE ar.shipment_id = $1
             ORDER BY ar.created_at DESC`,
            [shipmentId]
        );

        // Get chat history
        const { rows: history } = await pool.query(
            `SELECT role, content FROM ai_chat_messages 
             WHERE shipment_id = $1 
             ORDER BY created_at ASC
             LIMIT 20`,
            [shipmentId]
        );

        // Build system context
        let systemPrompt = `You are an AI assistant specializing in fruit export/import logistics. You are helping manage shipments.\n\n`;

        if (shipments.length > 0) {
            const s = shipments[0];
            systemPrompt += `**Shipment Information:**\n`;
            systemPrompt += `- Shipment: ${s.shipment_number}\n`;
            systemPrompt += `- Type: ${s.type}\n`;
            systemPrompt += `- Status: ${s.status}\n`;
            if (s.booking_number) systemPrompt += `- Booking: ${s.booking_number}\n`;
            if (s.forwarder_name) systemPrompt += `- Forwarder: ${s.forwarder_name}\n`;
            if (s.vessel_flight) systemPrompt += `- Vessel/Flight: ${s.vessel_flight}\n`;
            if (s.origin_port) systemPrompt += `- Route: ${s.origin_port} → ${s.destination_port}\n`;
            systemPrompt += '\n';
        }

        if (analyses.length > 0) {
            systemPrompt += `**Analyzed Documents (${analyses.length}):**\n`;
            for (const a of analyses) {
                const result = typeof a.result === 'string' ? JSON.parse(a.result) : a.result;
                systemPrompt += `\n--- ${a.document_type} (${a.file_name}) ---\n`;
                if (result.structured) {
                    systemPrompt += JSON.stringify(result.structured, null, 2);
                } else {
                    systemPrompt += result.text?.substring(0, 500) || 'No data';
                }
                systemPrompt += '\n';
            }
        }

        systemPrompt += '\nRespond concisely and accurately. If information is not available, state it clearly.';

        // Call AI (multi-provider)
        const aiResult = await callAI(
            systemPrompt,
            history.map(h => ({ role: h.role, content: h.content })),
            2048
        );

        // Save AI reply
        await pool.query(
            `INSERT INTO ai_chat_messages (shipment_id, role, content) VALUES ($1, 'assistant', $2)`,
            [shipmentId, aiResult.text]
        );

        res.json({
            success: true,
            reply: aiResult.text,
            tokensUsed: aiResult.tokensUsed,
        });
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({ error: error.message || 'AI chat failed' });
    }
});

// ===== GENERAL ASSISTANT: Build full DB context =====
async function buildFullDatabaseContext() {
    let context = '';

    try {
        // 1. Shipments overview
        const { rows: shipments } = await pool.query(`
            SELECT s.shipment_number, s.type, s.status, s.origin_port, s.destination_port,
                   s.origin_country, s.destination_country, s.cargo_description,
                   s.cargo_weight_kg, s.container_count, s.container_type,
                   s.etd, s.eta, s.atd, s.ata, s.total_cost_usd, s.incoterm,
                   c.company_name as customer_name, f.company_name as forwarder_name
            FROM shipments s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN forwarders f ON s.forwarder_id = f.id
            ORDER BY s.created_at DESC
            LIMIT 50
        `);
        if (shipments.length > 0) {
            context += `\n=== SHIPMENTS (${shipments.length} most recent) ===\n`;
            for (const s of shipments) {
                context += `• ${s.shipment_number} | ${s.type} | Status: ${s.status} | ${s.origin_country || s.origin_port || '?'} → ${s.destination_country || s.destination_port || '?'}`;
                if (s.customer_name) context += ` | Customer: ${s.customer_name}`;
                if (s.forwarder_name) context += ` | FWD: ${s.forwarder_name}`;
                if (s.cargo_description) context += ` | Cargo: ${s.cargo_description}`;
                if (s.cargo_weight_kg) context += ` | ${s.cargo_weight_kg}kg`;
                if (s.container_count) context += ` | ${s.container_count}x${s.container_type || 'cont'}`;
                if (s.etd) context += ` | ETD: ${s.etd}`;
                if (s.eta) context += ` | ETA: ${s.eta}`;
                if (s.total_cost_usd) context += ` | Cost: $${s.total_cost_usd}`;
                if (s.incoterm) context += ` | ${s.incoterm}`;
                context += '\n';
            }
        }

        // 2. Bookings & Deadlines
        const { rows: bookings } = await pool.query(`
            SELECT b.booking_number, b.type, b.status, b.vessel_flight, b.voyage_number,
                   b.route, b.origin_port, b.destination_port, b.container_type,
                   b.container_count, b.etd, b.eta, b.freight_rate_usd, b.shipping_line,
                   s.shipment_number,
                   f.company_name as forwarder_name,
                   bd.cut_off_si, bd.cut_off_vgm, bd.cut_off_cy, bd.sales_confirmed
            FROM bookings b
            LEFT JOIN shipments s ON b.shipment_id = s.id
            LEFT JOIN forwarders f ON b.forwarder_id = f.id
            LEFT JOIN booking_deadlines bd ON bd.booking_id = b.id
            ORDER BY b.created_at DESC
            LIMIT 50
        `);
        if (bookings.length > 0) {
            context += `\n=== BOOKINGS (${bookings.length}) ===\n`;
            for (const b of bookings) {
                context += `• ${b.booking_number} | ${b.type} | Status: ${b.status}`;
                if (b.shipment_number) context += ` | Shipment: ${b.shipment_number}`;
                if (b.forwarder_name) context += ` | FWD: ${b.forwarder_name}`;
                if (b.vessel_flight) context += ` | Vessel: ${b.vessel_flight}`;
                if (b.route) context += ` | Route: ${b.route}`;
                if (b.freight_rate_usd) context += ` | Rate: $${b.freight_rate_usd}`;
                if (b.etd) context += ` | ETD: ${b.etd}`;
                if (b.eta) context += ` | ETA: ${b.eta}`;
                if (b.cut_off_si) context += ` | SI cut-off: ${b.cut_off_si}`;
                if (b.cut_off_vgm) context += ` | VGM cut-off: ${b.cut_off_vgm}`;
                if (b.cut_off_cy) context += ` | CY cut-off: ${b.cut_off_cy}`;
                context += '\n';
            }
        }

        // 3. Documents status
        const { rows: docStats } = await pool.query(`
            SELECT s.shipment_number, d.document_type, d.status, d.file_name, d.document_number,
                   d.issue_date, d.expiry_date
            FROM documents d
            JOIN shipments s ON d.shipment_id = s.id
            WHERE d.deleted_at IS NULL
            ORDER BY d.created_at DESC
            LIMIT 100
        `);
        if (docStats.length > 0) {
            context += `\n=== DOCUMENTS (${docStats.length} most recent) ===\n`;
            for (const d of docStats) {
                context += `• ${d.shipment_number} | ${d.document_type} | ${d.status} | ${d.file_name}`;
                if (d.document_number) context += ` | No: ${d.document_number}`;
                if (d.expiry_date) context += ` | Expires: ${d.expiry_date}`;
                context += '\n';
            }
        }

        // 4. Vendors/Forwarders performance
        const { rows: forwarders } = await pool.query(`
            SELECT company_name, grade, on_time_rate, doc_accuracy_rate, cost_score,
                   credit_limit_monthly, status
            FROM forwarders
            ORDER BY grade ASC
        `);
        if (forwarders.length > 0) {
            context += `\n=== FORWARDERS / VENDORS (${forwarders.length}) ===\n`;
            for (const f of forwarders) {
                context += `• ${f.company_name} | Grade: ${f.grade} | On-time: ${f.on_time_rate}% | Doc accuracy: ${f.doc_accuracy_rate}% | Cost score: ${f.cost_score}`;
                if (f.credit_limit_monthly) context += ` | Credit limit: $${f.credit_limit_monthly}/month`;
                context += ` | ${f.status}\n`;
            }
        }

        // 5. Invoices / Financial
        const { rows: invoices } = await pool.query(`
            SELECT i.invoice_number, i.vendor_name, i.amount_usd, i.currency, i.status,
                   i.issue_date, i.due_date, i.paid_date, i.category, i.has_discrepancy,
                   s.shipment_number
            FROM invoices i
            LEFT JOIN shipments s ON i.shipment_id = s.id
            ORDER BY i.created_at DESC
            LIMIT 50
        `);
        if (invoices.length > 0) {
            context += `\n=== INVOICES / FINANCE (${invoices.length}) ===\n`;
            let totalPending = 0, totalPaid = 0;
            for (const inv of invoices) {
                context += `• ${inv.invoice_number} | ${inv.vendor_name || 'N/A'} | $${inv.amount_usd} ${inv.currency} | ${inv.status}`;
                if (inv.shipment_number) context += ` | Shipment: ${inv.shipment_number}`;
                if (inv.due_date) context += ` | Due: ${inv.due_date}`;
                if (inv.has_discrepancy) context += ` | ⚠️ DISCREPANCY`;
                context += '\n';
                if (inv.status === 'PENDING' || inv.status === 'OVERDUE') totalPending += parseFloat(inv.amount_usd) || 0;
                if (inv.status === 'PAID') totalPaid += parseFloat(inv.amount_usd) || 0;
            }
            context += `→ Total unpaid: $${totalPending.toFixed(2)} | Total paid: $${totalPaid.toFixed(2)}\n`;
        }

        // 6. Active alerts
        const { rows: alerts } = await pool.query(`
            SELECT a.type, a.severity, a.title, a.description, a.is_resolved,
                   s.shipment_number
            FROM alerts a
            LEFT JOIN shipments s ON a.shipment_id = s.id
            WHERE a.is_resolved = false
            ORDER BY a.created_at DESC
            LIMIT 20
        `);
        if (alerts.length > 0) {
            context += `\n=== ACTIVE ALERTS (${alerts.length}) ===\n`;
            for (const a of alerts) {
                context += `• [${a.severity}] ${a.title}`;
                if (a.shipment_number) context += ` | Shipment: ${a.shipment_number}`;
                if (a.description) context += ` | ${a.description}`;
                context += '\n';
            }
        }

        // 7. Pending tasks
        const { rows: tasks } = await pool.query(`
            SELECT t.title, t.task_type, t.status, t.priority, t.deadline,
                   s.shipment_number, u.full_name as assigned_to_name
            FROM tasks t
            LEFT JOIN shipments s ON t.shipment_id = s.id
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.status != 'COMPLETED'
            ORDER BY t.deadline ASC
            LIMIT 30
        `);
        if (tasks.length > 0) {
            context += `\n=== PENDING TASKS (${tasks.length}) ===\n`;
            for (const t of tasks) {
                context += `• ${t.title} | ${t.task_type} | ${t.status} | ${t.priority} | Deadline: ${t.deadline}`;
                if (t.shipment_number) context += ` | Shipment: ${t.shipment_number}`;
                if (t.assigned_to_name) context += ` | Assigned: ${t.assigned_to_name}`;
                context += '\n';
            }
        }

        // 8. Summary counts
        const { rows: summary } = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM shipments WHERE status NOT IN ('DELIVERED', 'CANCELLED')) as active_shipments,
                (SELECT COUNT(*) FROM bookings WHERE status IN ('PENDING', 'CONFIRMED')) as active_bookings,
                (SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL AND status IN ('UPLOADED', 'PENDING')) as pending_docs,
                (SELECT COUNT(*) FROM tasks WHERE status != 'COMPLETED') as pending_tasks,
                (SELECT COUNT(*) FROM alerts WHERE is_resolved = false) as active_alerts,
                (SELECT COUNT(*) FROM invoices WHERE status IN ('PENDING', 'OVERDUE')) as unpaid_invoices
        `);
        if (summary.length > 0) {
            const s = summary[0];
            context += `\n=== SYSTEM SUMMARY ===\n`;
            context += `• Active shipments: ${s.active_shipments}\n`;
            context += `• Active bookings: ${s.active_bookings}\n`;
            context += `• Pending documents: ${s.pending_docs}\n`;
            context += `• Incomplete tasks: ${s.pending_tasks}\n`;
            context += `• Active alerts: ${s.active_alerts}\n`;
            context += `• Unpaid invoices: ${s.unpaid_invoices}\n`;
        }

        // 9. Customers
        const { rows: customers } = await pool.query(`
            SELECT customer_code, company_name, contact_name, country, status
            FROM customers
            WHERE status = 'ACTIVE'
            ORDER BY company_name
        `);
        if (customers.length > 0) {
            context += `\n=== CUSTOMERS (${customers.length}) ===\n`;
            for (const c of customers) {
                context += `• ${c.customer_code} | ${c.company_name}`;
                if (c.contact_name) context += ` | Contact: ${c.contact_name}`;
                if (c.country) context += ` | ${c.country}`;
                context += '\n';
            }
        }

    } catch (error) {
        console.error('Error building DB context:', error);
        context += '\n[Lỗi khi truy vấn một số bảng dữ liệu]\n';
    }

    return context;
}

// ===== GENERAL ASSISTANT: CHAT =====
router.post('/assistant/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const finalSessionId = sessionId || `session_${Date.now()}`;

        // Save user message
        await pool.query(
            `INSERT INTO ai_general_chat (session_id, role, content) VALUES ($1, 'user', $2)`,
            [finalSessionId, message]
        );

        // Build full database context
        const dbContext = await buildFullDatabaseContext();
        const today = new Date().toISOString().split('T')[0];
        const customPrompt = await getCustomSystemPrompt();

        // Use custom prompt if set, otherwise use default
        const basePrompt = customPrompt || `You are a senior AI assistant for the Export/Import department at Ago Fruit, a Vietnamese fresh fruit export company.

CONTEXT:
- The user is the Export/Import Department Manager, NOT a logistics service provider.
- The company exports fresh fruits (dragon fruit, mango, pomelo, longan, lychee, durian, etc.)
- Ago Logistics app helps control operational processes and detect errors.`;

        const systemPrompt = `${basePrompt}

- Today's date: ${today}

LIVE SYSTEM DATA:
${dbContext}

RESPONSE GUIDELINES:
1. Respond with detailed, specific answers based on real data.
2. When answering about shipments, bookings → always cite specific codes (e.g. SHP-001, BK-001).
3. When analyzing risks → consider deadlines, document status, vendor performance.
4. When answering about finances → provide specific amounts and cost analysis.
5. If data is not available in the system → clearly state "The system does not have data on this topic."
6. Provide specific, actionable recommendations when appropriate.
7. Use clear formatting: bullet points, bold, specific figures.
8. DO NOT fabricate data — only use data provided above.`;

        // Get chat history for this session
        const { rows: history } = await pool.query(
            `SELECT role, content FROM ai_general_chat
             WHERE session_id = $1
             ORDER BY created_at ASC
             LIMIT 30`,
            [finalSessionId]
        );

        // Call AI (multi-provider)
        const aiResult = await callAI(
            systemPrompt,
            history.map(h => ({ role: h.role, content: h.content })),
            4096
        );

        // Save AI reply
        await pool.query(
            `INSERT INTO ai_general_chat (session_id, role, content, tokens_used) VALUES ($1, 'assistant', $2, $3)`,
            [finalSessionId, aiResult.text, aiResult.tokensUsed]
        );

        console.log(`🤖 AI Assistant chat: ${aiResult.tokensUsed} tokens used`);

        res.json({
            success: true,
            reply: aiResult.text,
            sessionId: finalSessionId,
            tokensUsed: aiResult.tokensUsed,
        });
    } catch (error) {
        console.error('AI assistant chat error:', error);
        res.status(500).json({ error: error.message || 'AI assistant chat failed' });
    }
});

// ===== GENERAL ASSISTANT: GET HISTORY =====
router.get('/assistant/history', async (req, res) => {
    try {
        const { sessionId } = req.query;
        if (!sessionId) {
            // Return the latest session
            const { rows: latest } = await pool.query(
                `SELECT DISTINCT session_id FROM ai_general_chat ORDER BY session_id DESC LIMIT 1`
            );
            if (latest.length === 0) return res.json({ messages: [], sessionId: null });

            const { rows } = await pool.query(
                `SELECT id, role, content, tokens_used, created_at FROM ai_general_chat
                 WHERE session_id = $1 ORDER BY created_at ASC`,
                [latest[0].session_id]
            );
            return res.json({ messages: rows, sessionId: latest[0].session_id });
        }

        const { rows } = await pool.query(
            `SELECT id, role, content, tokens_used, created_at FROM ai_general_chat
             WHERE session_id = $1 ORDER BY created_at ASC`,
            [sessionId]
        );
        res.json({ messages: rows, sessionId });
    } catch (error) {
        console.error('Error fetching assistant history:', error);
        res.json({ messages: [], sessionId: null });
    }
});

// ===== GENERAL ASSISTANT: CLEAR HISTORY (NEW CONVERSATION) =====
router.delete('/assistant/history', async (req, res) => {
    try {
        const { sessionId } = req.query;
        if (sessionId) {
            await pool.query(`DELETE FROM ai_general_chat WHERE session_id = $1`, [sessionId]);
        } else {
            await pool.query(`DELETE FROM ai_general_chat`);
        }
        res.json({ success: true, message: 'Chat history cleared' });
    } catch (error) {
        console.error('Error clearing assistant history:', error);
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

module.exports = router;
