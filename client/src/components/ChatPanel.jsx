import { BotIcon, BotMessageSquareIcon, UserIcon } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import PromptInput from './PromptInput';

const ChatPanel = ({ messages, onSend, loading }) => {
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }, [messages, loading]);

    return (
        <div className='flex flex-col h-full bg-white dark:bg-zinc-900 transition-colors'>
            {/* Messages */}
            <div className='flex-1 overflow-y-auto p-3 space-y-3 hide-scrollbar'>
                {messages.length === 0 && (
                    <div className='flex items-center justify-center h-full'>
                        <p className='text-zinc-400 dark:text-zinc-500 text-sm text-center'>Ask AI to modify your website</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={`${msg.role}-${i}`}>
                        <div className='flex gap-2.5 items-start'>
                            <div className='shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5 bg-zinc-100 dark:bg-zinc-800'>
                                {msg.role === "user" ? (
                                    <UserIcon size={14} className='text-zinc-500 dark:text-zinc-400' />
                                ) : (
                                    <BotMessageSquareIcon size={14} className='text-zinc-700 dark:text-zinc-300' />
                                )}
                            </div>
                            <div className='flex-1 min-w-0'>
                                <p className='text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider'>
                                    {msg.role === "user" ? "You" : "AI"}
                                </p>
                                <p className='text-[13px] text-zinc-700 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words'>
                                    {msg.content.split("- `/").map((text, textIndex) => (
                                        <span key={`${msg.role}-${i}-${textIndex}`} className='block mt-3 first:mt-0'>
                                            {textIndex > 0 && <span className='text-zinc-500 dark:text-zinc-400'>- `/</span>}
                                            {text}
                                        </span>
                                    ))}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className='flex gap-2.5 items-start'>
                        <div className='shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5 bg-zinc-100 dark:bg-zinc-800'>
                            <BotIcon size={13} className='text-zinc-900 dark:text-zinc-200' />
                        </div>
                        <div className='flex-1'>
                            <p className='text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wider'>AI</p>
                            <div className='dot-loader'>
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>
            {/* Input */}
            <div className='p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors'>
                <PromptInput
                    onSubmit={onSend}
                    loading={loading}
                    placeholder='Ask AI to modify...'
                    autoFocus
                    costHint="Costs 0.5 credit"
                />
            </div>
        </div>
    );
};

export default ChatPanel;
