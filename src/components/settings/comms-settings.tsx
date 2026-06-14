"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, MailCheck, Phone } from "lucide-react";

export function CommsSettings() {
  const [emailConfigured] = useState(!!process.env.NEXT_PUBLIC_RESEND_CONFIGURED);
  const [smsConfigured] = useState(!!process.env.NEXT_PUBLIC_TWILIO_CONFIGURED);

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email (Resend)
            </span>
            <Badge variant={emailConfigured ? "default" : "outline"}>
              {emailConfigured ? "Active" : "Not Connected"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Send emails from automations, inbox replies, and manual sends. Uses <a href="https://resend.com" className="text-blue-500 underline" target="_blank" rel="noopener">Resend</a> (free tier: 3,000 emails/month).
          </p>
          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
            <p className="font-mono text-muted-foreground">Environment variables needed:</p>
            <p className="font-mono">RESEND_API_KEY=re_xxx</p>
            <p className="font-mono">FROM_EMAIL=hello@yourclinic.com</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Add these in Vercel → Settings → Environment Variables, then redeploy.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> SMS (Twilio)
            </span>
            <Badge variant={smsConfigured ? "default" : "outline"}>
              {smsConfigured ? "Active" : "Not Connected"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Send SMS from automations and inbox. Uses <a href="https://twilio.com" className="text-blue-500 underline" target="_blank" rel="noopener">Twilio</a>.
          </p>
          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
            <p className="font-mono text-muted-foreground">Environment variables needed:</p>
            <p className="font-mono">TWILIO_ACCOUNT_SID=ACxxx</p>
            <p className="font-mono">TWILIO_AUTH_TOKEN=xxx</p>
            <p className="font-mono">TWILIO_PHONE_NUMBER=+44xxx</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Add these in Vercel → Settings → Environment Variables, then redeploy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
