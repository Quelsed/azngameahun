from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Application, CommandHandler, ContextTypes

TOKEN = "7973682932:AAEDjrvUDeyn4olfnk3iJUYK__-4HbL6lFA"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("Уйнарга", web_app={"url": "https://soft-belekoy-0e2f3a.netlify.app/"})]
    ])
    await update.message.reply_text("Уйнар өчен астагы кнопкага бас!", reply_markup=keyboard)

app = Application.builder().token(TOKEN).build()
app.add_handler(CommandHandler("start", start))
app.run_polling()
