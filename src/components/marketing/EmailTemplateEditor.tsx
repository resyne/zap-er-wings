import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Code, Eye, RotateCcw } from "lucide-react";

interface EmailTemplateEditorProps {
  htmlTemplate: string;
  onTemplateChange: (html: string) => void;
  senderEmail: string;
  onSenderEmailChange: (email: string) => void;
  senderName: string;
  onSenderNameChange: (name: string) => void;
  replyToEmail: string;
  onReplyToEmailChange: (email: string) => void;
}

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#1e3a5f;padding:24px 32px;text-align:center;">
          <img src="https://zap-er-wings.lovable.app/lovable-uploads/e8493046-02d3-407a-ae34-b061ef9720af.png" alt="ZAPPER" height="48" style="height:48px;" />
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:13px;color:#888;">A: {{recipient_name}} — {{recipient_company}}</p>
          <h2 style="margin:0 0 20px;font-size:18px;color:#1e3a5f;">{{subject}}</h2>
          <div style="font-size:15px;line-height:1.6;color:#333;">{{body}}</div>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0;font-size:13px;color:#666;">Cordiali saluti,<br><strong>{{sender_name}}</strong></p>
        </td></tr>
        <tr><td style="background:#f8f9fa;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#999;">info@abbattitorizapper.it | Scafati (SA) - Italy | 08119968436</p>
          <p style="margin:4px 0 0;font-size:11px;"><a href="https://www.abbattitorizapper.it" style="color:#1e3a5f;">www.abbattitorizapper.it</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export { DEFAULT_TEMPLATE };

export function EmailTemplateEditor({
  htmlTemplate,
  onTemplateChange,
  senderEmail,
  onSenderEmailChange,
  senderName,
  onSenderNameChange,
}: EmailTemplateEditorProps) {
  const [editorTab, setEditorTab] = useState("preview");

  const previewHtml = htmlTemplate
    .replace(/\{\{subject\}\}/g, "Oggetto email di esempio")
    .replace(/\{\{body\}\}/g, "Buongiorno,<br><br>Questo è un esempio del corpo email che verrà generato dall'AI per ogni lead, personalizzato in base al sito web analizzato.<br><br>Ogni email sarà diversa e contestualizzata.")
    .replace(/\{\{recipient_name\}\}/g, "Mario Rossi")
    .replace(/\{\{recipient_company\}\}/g, "Azienda Esempio")
    .replace(/\{\{sender_name\}\}/g, senderName || "Il Team")
    .replace(/\{\{city\}\}/g, "Milano")
    .replace(/\{\{url\}\}/g, "https://esempio.it");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Template Email HTML
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTemplateChange(DEFAULT_TEMPLATE)}
            className="text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Email mittente *</Label>
            <Input
              value={senderEmail}
              onChange={(e) => onSenderEmailChange(e.target.value)}
              placeholder="noreply@tuodominio.com"
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Nome mittente</Label>
            <Input
              value={senderName}
              onChange={(e) => onSenderNameChange(e.target.value)}
              placeholder="ZAPPER Team"
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">{"{{subject}}"}</Badge>
          <Badge variant="outline" className="text-[10px]">{"{{body}}"}</Badge>
          <Badge variant="outline" className="text-[10px]">{"{{recipient_name}}"}</Badge>
          <Badge variant="outline" className="text-[10px]">{"{{recipient_company}}"}</Badge>
          <Badge variant="outline" className="text-[10px]">{"{{sender_name}}"}</Badge>
          <Badge variant="outline" className="text-[10px]">{"{{city}}"}</Badge>
          <Badge variant="outline" className="text-[10px]">{"{{url}}"}</Badge>
        </div>

        <Tabs value={editorTab} onValueChange={setEditorTab}>
          <TabsList className="h-7">
            <TabsTrigger value="preview" className="text-xs h-6 px-3">
              <Eye className="h-3 w-3 mr-1" />Anteprima
            </TabsTrigger>
            <TabsTrigger value="html" className="text-xs h-6 px-3">
              <Code className="h-3 w-3 mr-1" />HTML
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-2">
            <div className="border rounded-lg overflow-hidden bg-muted/30" style={{ maxHeight: 400 }}>
              <iframe
                srcDoc={previewHtml}
                className="w-full border-0"
                style={{ height: 380 }}
                title="Email Preview"
                sandbox=""
              />
            </div>
          </TabsContent>

          <TabsContent value="html" className="mt-2">
            <textarea
              value={htmlTemplate}
              onChange={(e) => onTemplateChange(e.target.value)}
              className="w-full h-[380px] font-mono text-xs p-3 rounded-lg border bg-muted/30 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              spellCheck={false}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
