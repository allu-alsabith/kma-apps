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
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 flex flex-col shadow-xl animate-scale-in border border-[#E2E8F0] text-[#1E293B]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB] border border-blue-100">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1E293B]">Account Help &amp; Support</h3>
              <p className="text-[11px] text-slate-500">Can&apos;t sign in or need account assistance?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submittedSuccess ? (
          <div className="py-8 flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-[#1E293B]">Help Request Submitted</h4>
            <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
              Your request from <span className="text-[#2563EB] font-semibold">{appName}</span> has been received. Store management will assist you shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            
            {/* Originating App Tag */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
              <span className="text-slate-500 text-[11px]">Requesting From:</span>
              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1.5 ${getAppBadgeColor()}`}>
                {getAppIcon()}
                <span>{appName}</span>
              </span>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* User / Employee Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Your Name or Employee ID
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Enter your name or ID"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded-lg pl-9 pr-3 py-2 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Company or Store Name
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Enter company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded-lg pl-9 pr-3 py-2 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
              </div>
            </div>

            {/* Contact Info & Issue Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Contact Phone or Email
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Enter phone or email"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    className="w-full bg-white border border-[#CBD5E1] rounded-lg pl-9 pr-3 py-2 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Issue Category
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value as HelpRequestIssueType)}
                  className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-xs text-[#1E293B] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
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
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                What do you need help with? <span className="text-[#2563EB]">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe the issue you are experiencing"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-white border border-[#CBD5E1] rounded-lg p-3 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] leading-relaxed resize-none"
              />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="py-2.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
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
