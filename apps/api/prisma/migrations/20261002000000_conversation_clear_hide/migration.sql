-- "Clear chat" hides messages from the user's screen (the character still remembers);
-- "Delete chat" from the Chats tab also hides the chat from the list until a new message arrives.
ALTER TABLE "conversations" ADD COLUMN "cleared_at" TIMESTAMPTZ(6);
ALTER TABLE "conversations" ADD COLUMN "hidden_at" TIMESTAMPTZ(6);
