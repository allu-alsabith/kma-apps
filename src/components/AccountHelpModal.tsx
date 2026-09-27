import React, { useState } from 'react';
import { 
  HelpCircle, 
  X, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  User, 
  Phone, 
  Smartphone,
  ScanFace,
  ShieldCheck,
  LifeBuoy
} from 'lucide-react';
import { HelpRequest, HelpRequestIssueType } from '../types';
import { soundService } from '../services/sound';

interface AccountHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string; // e.g. "Entrance Face Kiosk", "Staff Mobile App", "Store Admin Console"
  defaultCompanyName?: string;
  defaultCompanyCode?: string;
  onSubmitHelpRequest: (request: Omit<HelpRequest, 'id' | 'createdAt' | 'status'>) => Promise<void> | void;
}

export const AccountHelpModal: React.FC<AccountHelpModalProps> = ({
  isOpen,
  onClose,
  appName,
  defaultCompanyName = '',
  defaultCompanyCode = '',
  onSubmitHelpRequest,
}) => {
  const [userName, setUserName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>(defaultCompanyName || defaultCompanyCode || '');
  const [contactInfo, setContactInfo] = useState<string>('');
  const [issueType, setIssueType] = useState<HelpRequestIssueType>('CANNOT_LOGIN');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!message.trim()) {
      setFormError('Please describe the issue or what you need assistance with.');
      soundService.playWarningTone();
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmitHelpRequest({
        appName,
        companyName: companyName.trim() || undefined,
        companyCode: defaultCompanyCode || undefined,
        userName: userName.trim() || 'Staff / User',
        contactInfo: contactInfo.trim() || undefined,
        issueType,
        message: message.trim(),
      });

      soundService.playSuccessChime();
      setSubmittedSuccess(true);
      setTimeout(() => {
        setSubmittedSuccess(false);
        setMessage('');
        onClose();
      }, 2400);
    } catch (err) {
      setFormError('Failed to submit request. Please try again.');
      soundService.playWarningTone();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAppBadgeColor = () => {
    if (appName.includes('Face') || appName.includes('Kiosk')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (appName.includes('Staff') || appName.includes('Mobile')) return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
  };

  const getAppIcon = () => {
    if (appName.includes('Face') || appName.includes('Kiosk')) return <ScanFace className="w-3.5 h-3.5 text-emerald-400" />;
    if (appName.includes('Staff') || appName.includes('Mobile')) return <Smartphone className="w-3.5 h-3.5 text-sky-400" />;
    return <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-md liquid-glass-card rounded-[36px] p-6 flex flex-col shadow-2xl animate-scale-in border border-white/20">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl liquid-glass flex items-center justify-center text-amber-400 border border-amber-500/30">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Account Help &amp; Support</h3>
              <p className="text-[11px] text-slate-400">Can&apos;t sign in or need account assistance?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submittedSuccess ? (
          <div className="py-8 flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-white">Help Request Submitted</h4>
            <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
              Your request from <span className="text-emerald-300 font-semibold">{appName}</span> has been received. Store management will assist you shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            
            {/* Originating App Tag */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs">
              <span className="text-slate-400 text-[11px]">Requesting From:</span>
              <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 ${getAppBadgeColor()}`}>
                {getAppIcon()}
                <span>{appName}</span>
              </span>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* User / Employee Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Your Name or Employee ID
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="e.g. Sarah / EMP-101"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 rounded-2xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Company or Store Name
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Enter supermarket or company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 rounded-2xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Contact Info & Issue Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Contact Phone or Email
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="+91 ... or email"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 rounded-2xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Issue Category
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value as HelpRequestIssueType)}
                  className="w-full bg-slate-900 border border-white/15 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="CANNOT_LOGIN">Cannot Log In / Auth Error</option>
                  <option value="PIN_PASSWORD_RESET">Forgot PIN or Password</option>
                  <option value="FACE_SCAN_FAIL">Face Biometrics Not Recognized</option>
                  <option value="TERMINAL_PAIRING">Terminal Pairing / Code Issue</option>
                  <option value="ACCOUNT_LOCKED">Account Inactive or Locked</option>
                  <option value="OTHER">Other Issue / Feedback</option>
                </select>
              </div>
            </div>

            {/* Message / Description */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                What do you need help with? <span className="text-amber-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe what is happening (e.g. My PIN is not accepted, cannot sign into tablet, face scan does not identify me...)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-900 border border-white/15 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 leading-relaxed resize-none"
              />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="py-2.5 rounded-xl liquid-pill text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Request'}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
