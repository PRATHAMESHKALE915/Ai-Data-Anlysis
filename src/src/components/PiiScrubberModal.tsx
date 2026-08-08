import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Eye, EyeOff, Lock, CheckCircle2, Copy, Check } from 'lucide-react';
import { scrubPiiText, PiiRuleOptions, PiiScanResult } from '../lib/piiScrubber';

interface PiiScrubberModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawContent: string;
  onApplyScrubbedContent: (newContent: string) => void;
  fileName?: string;
}

export const PiiScrubberModal: React.FC<PiiScrubberModalProps> = ({
  isOpen,
  onClose,
  rawContent,
  onApplyScrubbedContent,
  fileName = 'Dataset',
}) => {
  const [options, setOptions] = useState<PiiRuleOptions>({
    email: true,
    phone: true,
    creditCard: true,
    ipAddress: true,
    ssn: true,
    names: false,
  });

  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  if (!isOpen) return null;

  const scanResult: PiiScanResult = scrubPiiText(rawContent, options);

  const toggleOption = (key: keyof PiiRuleOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApply = () => {
    onApplyScrubbedContent(scanResult.scrubbedText);
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(scanResult.scrubbedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${scanResult.totalDetections > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {scanResult.totalDetections > 0 ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                Smart Data Privacy & PII Scrubbing Studio
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">
                  {fileName}
                </span>
              </h2>
              <p className="text-xs text-neutral-500">
                Detect, mask, and redact sensitive personal information before sending data to AI models.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Rule Toggles */}
          <div>
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              Active Anonymization Rules
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'email', label: 'Email Addresses', count: scanResult.counts.email, color: 'text-blue-700 bg-blue-100' },
                { key: 'phone', label: 'Phone Numbers', count: scanResult.counts.phone, color: 'text-emerald-700 bg-emerald-100' },
                { key: 'creditCard', label: 'Credit Card Numbers', count: scanResult.counts.creditCard, color: 'text-red-700 bg-red-100' },
                { key: 'ipAddress', label: 'IP Addresses', count: scanResult.counts.ipAddress, color: 'text-purple-700 bg-purple-100' },
                { key: 'ssn', label: 'SSN / National IDs', count: scanResult.counts.ssn, color: 'text-amber-700 bg-amber-100' },
                { key: 'names', label: 'Common Names', count: scanResult.counts.names, color: 'text-teal-700 bg-teal-100' },
              ].map(({ key, label, count, color }) => {
                const active = options[key as keyof PiiRuleOptions];
                return (
                  <button
                    key={key}
                    onClick={() => toggleOption(key as keyof PiiRuleOptions)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? 'border-blue-500 bg-blue-50/50 text-neutral-900 shadow-2xs'
                        : 'border-neutral-200 text-neutral-400 bg-neutral-50/30 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${active ? 'bg-blue-500' : 'bg-neutral-300'}`} />
                      <span>{label}</span>
                    </div>
                    {count > 0 && active && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
                        {count} masked
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detections Summary */}
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-neutral-900">
                {scanResult.totalDetections}
              </span>
              <div>
                <p className="text-xs font-bold text-neutral-800">
                  {scanResult.totalDetections === 0 ? 'No Sensitive PII Detected' : 'Sensitive Items Auto-Masked'}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {scanResult.totalDetections === 0
                    ? 'Your dataset is clean and safe for processing.'
                    : 'All matches are sanitized with compliance tags like [EMAIL_REDACTED].'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200/60 rounded-lg transition-colors cursor-pointer"
              >
                {showOriginal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showOriginal ? 'Show Masked Text' : 'View Original'}
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied Masked' : 'Copy Masked'}
              </button>
            </div>
          </div>

          {/* Text Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                {showOriginal ? 'Original Dataset Preview' : 'Redacted Output Preview'}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                {rawContent.length.toLocaleString()} characters
              </span>
            </div>
            <pre className="p-4 rounded-xl bg-neutral-900 text-neutral-100 font-mono text-xs max-h-60 overflow-auto border border-neutral-800 leading-relaxed whitespace-pre-wrap">
              {showOriginal ? rawContent : scanResult.scrubbedText}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleApply}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Apply Masking to Dataset
          </button>
        </div>
      </div>
    </div>
  );
};
