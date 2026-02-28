// ALPHA SUPREME TICKET SYSTEM - VERSÃO INDUSTRIAL 2026
// CORREÇÃO CRÍTICA: Adicionado deferReply para evitar "Interação falhou" e IDs únicos para evitar undefined.
// Focado em Tópicos Privados, Transcripts e Decisão da Staff.

const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, REST, Routes,
    Collection, AttachmentBuilder, ActivityType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Inicialização do Cliente com Intents Industriais
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ] 
});

// Configurações de Ambiente (Railway)
const TOKEN = process.env.DISCORD_TOKEN;
const ID_CARGO_STAFF = '1452822605773148312'; 
const CANAL_TICKET_POST = '1476773027516518470';
const CANAL_LOGS_DENUNCIA = '1476775424540282934';

// Sistemas de Gerenciamento de Memória e Anti-Crash
const sessionCache = new Collection();
const coletaThreads = new Collection();
const ticketCooldown = new Collection();
const logsAuditoria = new Collection();

// Segurança Global contra quedas
process.on('unhandledRejection', (reason) => console.error(' [PROMESSA FALHOU] ', reason));
process.on('uncaughtException', (err) => console.error(' [EXCEÇÃO FATAL] ', err));

// Função Industrial de Transcript (Audit Log)
async function generateAuditLog(thread, user) {
    const messages = await thread.messages.fetch({ limit: 100 });
    let data = `ALPHA SYSTEM - AUDITORIA DE TICKET\n`;
    data += `Ticket: ${thread.name}\nUsuário: ${user.tag}\nData: ${new Date().toLocaleString()}\n`;
    data += `--------------------------------------------------\n\n`;

    messages.reverse().forEach(m => {
        const time = m.createdAt.toLocaleTimeString();
        data += `[${time}] ${m.author.tag}: ${m.cleanContent || "[Anexo/Embed]"}\n`;
    });

    const fileName = `audit-${thread.id}.txt`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, data);
    return { filePath, fileName };
}

client.once('ready', async () => {
    console.log(`[SYSTEM] Bot Ticket SZ Online: ${client.user.tag}`);
    client.user.setActivity('Tickets Alpha Supreme', { type: ActivityType.Watching });

    const commands = [{
        name: 'setupsz',
        description: 'Envia o painel industrial de atendimento Alpha',
        default_member_permissions: PermissionFlagsBits.Administrator.toString()
    }];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[SYSTEM] Comandos Slash Sincronizados com Sucesso.');
    } catch (e) {
        console.error('[SYSTEM] Falha no REST:', e);
    }
});

client.on('interactionCreate', async (i) => {
    
    // --- SETUP DO PAINEL PRINCIPAL ---
    if (i.isChatInputCommand() && i.commandName === 'setupsz') {
        if (i.channelId !== CANAL_TICKET_POST) {
            return i.reply({ content: `❌ Use este comando em <#${CANAL_TICKET_POST}>`, ephemeral: true });
        }

        const embedMain = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE ATENDIMENTO - ALPHA')
            .setDescription('Selecione a categoria e confirme no botão para abrir seu atendimento.\n\n🔒 **Privacidade:** A primeira etapa é 100% privada.')
            .setColor('#2b2d31')
            .setFooter({ text: 'Alpha Supreme Ticket System' });

        const menuMain = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('main_select').setPlaceholder('Escolha o assunto...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'CAT_BAN', emoji: '🔨' },
                    { label: 'SIMU (Simulados)', value: 'CAT_SIMU', emoji: '🏆' },
                    { label: 'FALHA EM AP', value: 'CAT_AP', emoji: '💰' }
                ])
        );

        const btnMain = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_open').setLabel('ABRIR TICKET').setStyle(ButtonStyle.Success).setEmoji('📩')
        );

        await i.reply({ content: '✅ Painel gerado!', ephemeral: true });
        return i.channel.send({ embeds: [embedMain], components: [menuMain, btnMain] });
    }

    // --- CACHE DE SESSÃO COM DEFER REPLY (EVITA FALHA) ---
    if (i.isStringSelectMenu() && i.customId === 'main_select') {
        await i.deferUpdate(); // Avisa o Discord que recebemos a interação
        sessionCache.set(i.user.id, i.values[0]);
        return i.followUp({ content: `✅ Categoria **${i.values[0].replace('CAT_', '')}** marcada!`, ephemeral: true });
    }

    // --- ABERTURA DO TÓPICO PRIVADO ---
    if (i.isButton() && i.customId === 'confirm_open') {
        const cat = sessionCache.get(i.user.id);
        if (!cat) return i.reply({ content: '❌ Selecione no menu primeiro!', ephemeral: true });

        if (ticketCooldown.has(i.user.id)) {
            return i.reply({ content: '⏳ Você já tem um ticket em andamento.', ephemeral: true });
        }

        try {
            const threadSolo = await i.channel.threads.create({
                name: `coleta-${i.user.username}`,
                type: ChannelType.PrivateThread,
                autoArchiveDuration: 60
            });

            await threadSolo.members.add(i.user.id);
            coletaThreads.set(i.user.id, threadSolo.id);
            ticketCooldown.set(i.user.id, Date.now());

            let menuSub;
            if (cat === 'CAT_BAN') {
                menuSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_ban_choice').setPlaceholder('BAN: Detalhe...')
                    .addOptions([{ label: 'Xingamento', value: 'Xingamento' }, { label: 'Foto Inapropriada', value: 'Foto Inapropriada' }, { label: 'Ameaça', value: 'Ameaça' }, { label: 'Outro', value: 'Outro' }]));
            } else if (cat === 'CAT_SIMU') {
                menuSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_simu_choice').setPlaceholder('SIMU: Detalhe...')
                    .addOptions([{ label: 'Favoritismo', value: 'Favoritismo' }, { label: 'Partidas Repetidas', value: 'Partidas Repetidas' }]));
            } else if (cat === 'CAT_AP') {
                menuSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_ap_choice').setPlaceholder('AP: Detalhe...')
                    .addOptions([{ label: 'Desrespeito', value: 'Desrespeito' }, { label: 'Dinheiro Errado', value: 'Dinheiro Errado' }, { label: 'Valor não pago', value: 'Valor não pago' }]));
            }

            const btnCancel = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('kill_coleta').setLabel('CANCELAR').setStyle(ButtonStyle.Danger));

            await threadSolo.send({ content: `👋 ${i.user}, escolha o ocorrido para **${cat.replace('CAT_', '')}**:`, components: [menuSub, btnCancel] });
            return i.reply({ content: `✅ Tópico privado: ${threadSolo}`, ephemeral: true });
        } catch (e) {
            return i.reply({ content: '❌ Erro ao criar tópico. Verifique as permissões.', ephemeral: true });
        }
    }

    // --- CANCELAR ---
    if (i.isButton() && i.customId === 'kill_coleta') {
        ticketCooldown.delete(i.user.id);
        await i.reply('🔒 Fechando...');
        return setTimeout(() => i.channel.delete().catch(() => {}), 2000);
    }

    // --- MODAIS (CORREÇÃO UNDEFINED + IDs EXPLÍCITOS) ---
    if (i.isStringSelectMenu() && i.customId.endsWith('_choice')) {
        const sub = i.values[0];
        const cat = i.customId.split('_')[1].toUpperCase();
        let modal = new ModalBuilder().setCustomId(`f_form|${cat}|${sub}`).setTitle(`${cat}: ${sub}`);

        if (sub === 'Xingamento' || sub === 'Desrespeito') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_quem').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_msg').setLabel("QUAL FOI A MENSAGEM?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (sub === 'Partidas Repetidas') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_falado').setLabel("O QUE FOI FALADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_real').setLabel("O QUE REALMENTE ACONTECEU?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_mentiroso').setLabel("QUEM MENTIU?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_dono').setLabel("DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (sub === 'Favoritismo') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_ajudado').setLabel("QUEM FOI AJUDADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_dono').setLabel("DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (sub === 'Dinheiro Errado') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_quem').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_proposto').setLabel("VALOR PROPOSTO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_pago').setLabel("VALOR PAGO?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_quem').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f_relato').setLabel("RELATO/MOTIVO").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        }
        return await i.showModal(modal);
    }

    // --- ENVIO PARA STAFF (SEM ERRO DE UNDEFINED) ---
    if (i.type === InteractionType.ModalSubmit && i.customId.startsWith('f_form|')) {
        const [_, cat, sub] = i.customId.split('|');
        const campos = i.fields.fields.map(f => `**${f.label}:** ${f.value}`).join('\n');

        const embedStaff = new EmbedBuilder()
            .setTitle(`🚨 Revisão Pendente [${cat}]`)
            .setDescription(`**RECEBIMENTO: SIM**\n\n**Denunciador:** <@${i.user.id}>\n**Motivo:** ${sub}\n\n**Dados do Relatório:**\n${campos}`)
            .setColor('#f1c40f').setTimestamp();

        const btns = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`dec_talk_${i.user.id}`).setLabel('INTERAGIR').setStyle(ButtonStyle.Primary).setEmoji('💬'),
            new ButtonBuilder().setCustomId(`dec_done_${i.user.id}`).setLabel('RESOLVIDO').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId(`dec_fail_${i.user.id}`).setLabel('INSUFICIENTE').setStyle(ButtonStyle.Danger).setEmoji('❌')
        );

        const logChan = i.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        if (logChan) await logChan.send({ content: `🚨 **Nova Denúncia** | <@&${ID_CARGO_STAFF}>`, embeds: [embedStaff], components: [btns] });

        await i.reply({ content: '✅ Relatório enviado! Staff acionada.', ephemeral: true });
        
        const coletaThreadId = coletaThreads.get(i.user.id);
        if (coletaThreadId) {
            const t = i.guild.channels.cache.get(coletaThreadId);
            if (t) setTimeout(() => t.delete().catch(() => {}), 2000);
            coletaThreads.delete(i.user.id);
        }
    }

    // --- DECISÃO STAFF ---
    if (i.isButton() && i.customId.startsWith('dec_')) {
        const [_, action, targetId] = i.customId.split('_');
        const player = await client.users.fetch(targetId).catch(() => null);

        if (action === 'talk') {
            const tTalk = await i.channel.threads.create({ name: `interacao-${targetId}`, type: ChannelType.PublicThread });
            await tTalk.members.add(targetId);
            await tTalk.send({ content: `👋 <@${targetId}>, Staff <@${i.user.id}> iniciou a conversa.\n\n🛠️ Use para encerrar:`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`close_audit_${targetId}`).setLabel('ENCERRAR E GERAR LOG').setStyle(ButtonStyle.Danger))] });
            return i.reply({ content: `✅ Tópico aberto: ${tTalk}`, ephemeral: true });
        }

        if (action === 'done') {
            if (player) await player.send(`✅ **Alpha:** Seu caso foi **RESOLVIDO**.`).catch(() => {});
            await i.update({ content: `✅ **RESOLVIDO** por <@${i.user.id}>`, components: [], embeds: i.message.embeds });
            ticketCooldown.delete(targetId);
        }

        if (action === 'fail') {
            if (player) await player.send(`❌ **Alpha:** Caso marcado como **INSUFICIENTE**.`).catch(() => {});
            await i.update({ content: `❌ **INSUFICIENTE** por <@${i.user.id}>`, components: [], embeds: i.message.embeds });
            ticketCooldown.delete(targetId);
        }
    }

    // --- FINALIZAÇÃO ---
    if (i.isButton() && i.customId.startsWith('close_audit_')) {
        const targetId = i.customId.split('_');
        const { filePath, fileName } = await generateAuditLog(i.channel, { tag: `id-${targetId}` });
        const logChan = i.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        if (logChan) await logChan.send({ content: `📁 Transcript Gerado:`, files: [new AttachmentBuilder(filePath)] });
        await i.reply('🔒 Encerrando tópico...');
        setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); i.channel.delete().catch(() => {}); ticketCooldown.delete(targetId); }, 5000);
    }
});

client.login(TOKEN);
