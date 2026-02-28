// ALPHA SUPREME TICKET SYSTEM - VERSÃO INDUSTRIAL 2026
// CORREÇÃO: Erro de 'undefined' nos campos do Modal resolvido com IDs explícitos.
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
            .setDescription('Selecione a categoria e clique no botão para iniciar um atendimento privado.\n\n🔒 **Importante:** A coleta de dados é invisível para outros jogadores.')
            .setColor('#2b2d31')
            .setFooter({ text: 'Alpha Supreme Ticket System' });

        const menuMain = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('main_select').setPlaceholder('Escolha o assunto principal...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'CAT_BAN', emoji: '🔨' },
                    { label: 'SIMU (Simulados)', value: 'CAT_SIMU', emoji: '🏆' },
                    { label: 'FALHA EM AP', value: 'CAT_AP', emoji: '💰' }
                ])
        );

        const btnMain = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_coleta').setLabel('ABRIR TICKET').setStyle(ButtonStyle.Success).setEmoji('📩')
        );

        await i.reply({ content: '✅ Painel gerado!', ephemeral: true });
        return i.channel.send({ embeds: [embedMain], components: [menuMain, btnMain] });
    }

    // --- CACHE DE SESSÃO ---
    if (i.isStringSelectMenu() && i.customId === 'main_select') {
        sessionCache.set(i.user.id, i.values);
        return i.reply({ content: `✅ Categoria **${i.values.replace('CAT_', '')}** marcada! Clique no botão verde.`, ephemeral: true });
    }

    // --- ABERTURA DO TÓPICO DE COLETA PRIVADO ---
    if (i.isButton() && i.customId === 'start_coleta') {
        const cat = sessionCache.get(i.user.id);
        if (!cat) return i.reply({ content: '❌ Por favor, selecione uma categoria no menu antes!', ephemeral: true });

        if (ticketCooldown.has(i.user.id)) {
            return i.reply({ content: '⏳ Você já tem um ticket ativo ou está em cooldown.', ephemeral: true });
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

            let rowSub;
            if (cat === 'CAT_BAN') {
                rowSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_ban').setPlaceholder('Motivo do BAN...')
                    .addOptions([
                        { label: 'Xingamento', value: 'Xingamento' },
                        { label: 'Foto Inapropriada', value: 'Foto Inapropriada' },
                        { label: 'Ameaça', value: 'Ameaça' },
                        { label: 'Outro', value: 'Outro' }
                    ]));
            } else if (cat === 'CAT_SIMU') {
                rowSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_simu').setPlaceholder('Motivo do SIMU...')
                    .addOptions([
                        { label: 'Favoritismo', value: 'Favoritismo' },
                        { label: 'Partidas Repetidas', value: 'Partidas Repetidas' }
                    ]));
            } else if (cat === 'CAT_AP') {
                rowSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_ap').setPlaceholder('Motivo do AP...')
                    .addOptions([
                        { label: 'Desrespeito', value: 'Desrespeito' },
                        { label: 'Dinheiro Errado', value: 'Dinheiro Errado' },
                        { label: 'Valor não pago', value: 'Valor não pago' }
                    ]));
            }

            const btnCancel = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('stop_coleta').setLabel('CANCELAR').setStyle(ButtonStyle.Danger));

            await threadSolo.send({ 
                content: `👋 ${i.user}, escolha o detalhe abaixo para categoria **${cat.replace('CAT_', '')}**:`, 
                components: [rowSub, btnCancel] 
            });

            return i.reply({ content: `✅ Tópico privado iniciado: ${threadSolo}`, ephemeral: true });
        } catch (e) {
            console.error(e);
            return i.reply({ content: '❌ Erro ao criar tópico. Verifique as permissões do bot.', ephemeral: true });
        }
    }

    // --- CANCELAR COLETA ---
    if (i.isButton() && i.customId === 'stop_coleta') {
        ticketCooldown.delete(i.user.id);
        await i.reply('🔒 Fechando tópico privado...');
        return setTimeout(() => i.channel.delete().catch(() => {}), 2000);
    }

    // --- MODAIS COM IDs EXPLÍCITOS (CORREÇÃO DO UNDEFINED) ---
    if (i.isStringSelectMenu() && i.customId.startsWith('sub_')) {
        const sub = i.values;
        const cat = i.customId.replace('sub_', '').toUpperCase();
        let modal = new ModalBuilder().setCustomId(`final_form|${cat}|${sub}`).setTitle(`${cat}: ${sub}`);

        if (sub === 'Xingamento' || sub === 'Desrespeito') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_quem').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_msg').setLabel("QUAL FOI A MENSAGEM?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (sub === 'Foto Inapropriada') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_quem').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_msg').setLabel("CONTEÚDO DA FOTO?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (sub === 'Ameaça') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_quem').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_msg').setLabel("QUAL A AMEAÇA? (PRINT OBRIGATÓRIO)").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (sub === 'Favoritismo') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_ajudado').setLabel("QUEM FOI AJUDADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_dono').setLabel("DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (sub === 'Partidas Repetidas') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_falado').setLabel("O QUE FOI FALADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_aconteceu').setLabel("O QUE REALMENTE ACONTECEU?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_mentiroso').setLabel("QUEM FOI O MENTIROSO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_dono').setLabel("QUEM FOI O DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (sub === 'Dinheiro Errado') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_quem').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_v1').setLabel("VALOR PROPOSTO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_v2').setLabel("VALOR PAGO?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (sub === 'Valor não pago') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_quem').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_valor').setLabel("VALOR?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_motivo').setLabel("PORQUE NÃO PAGOU?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_assunto').setLabel("O QUE OCORREU?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('campo_relato').setLabel("RELATE OS DETALHES").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        }

        return await i.showModal(modal);
    }

    // --- PROCESSAMENTO FINAL E ENVIO PARA STAFF (SEM UNDEFINED) ---
    if (i.type === InteractionType.ModalSubmit && i.customId.startsWith('final_form|')) {
        const [_, cat, sub] = i.customId.split('|');
        
        // Mapeamento dinâmico para evitar o erro 'undefined'
        const camposData = i.fields.fields.map(f => {
            const label = f.label || "Informação";
            const value = f.value || "Não informado";
            return `**${label}:** ${value}`;
        }).join('\n');

        const embedStaff = new EmbedBuilder()
            .setTitle(`🚨 Revisão Pendente [${cat}]`)
            .setDescription(`**RECEBIMENTO: SIM**\n\n**Denunciador:** <@${i.user.id}>\n**Motivo:** ${sub}\n\n**Dados do Relatório:**\n${camposData}`)
            .setColor('#f1c40f')
            .setTimestamp()
            .setThumbnail(i.user.displayAvatarURL());

        const rowDecision = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`st_talk_${i.user.id}`).setLabel('INTERAGIR').setStyle(ButtonStyle.Primary).setEmoji('💬'),
            new ButtonBuilder().setCustomId(`st_done_${i.user.id}`).setLabel('RESOLVIDO').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId(`st_fail_${i.user.id}`).setLabel('INSUFICIENTE').setStyle(ButtonStyle.Danger).setEmoji('❌')
        );

        const logChan = i.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        if (logChan) {
            await logChan.send({ content: `🚨 **Nova Denúncia [${cat}]** | <@&${ID_CARGO_STAFF}>`, embeds: [embedStaff], components: [rowDecision] });
        }

        await i.reply({ content: '✅ Relatório enviado! A Staff analisará e tomará uma decisão.', ephemeral: true });
        
        const coletaThreadId = coletaThreads.get(i.user.id);
        if (coletaThreadId) {
            const t = i.guild.channels.cache.get(coletaThreadId);
            if (t) setTimeout(() => t.delete().catch(() => {}), 2000);
            coletaThreads.delete(i.user.id);
        }
    }

    // --- DECISÃO DA STAFF ---
    if (i.isButton() && i.customId.startsWith('st_')) {
        const [_, action, targetId] = i.customId.split('_');
        const player = await client.users.fetch(targetId).catch(() => null);

        if (action === 'talk') {
            const threadTalk = await i.channel.threads.create({
                name: `atendimento-${targetId}`,
                type: ChannelType.PublicThread,
                autoArchiveDuration: 60
            });
            await threadTalk.members.add(targetId);
            await threadTalk.send({ content: `👋 <@${targetId}>, Staff <@${i.user.id}> iniciou a conversa.\n\n🛠️ Use o botão para encerrar:`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`audit_close_${targetId}`).setLabel('ENCERRAR E GERAR LOG').setStyle(ButtonStyle.Danger))] });
            return i.reply({ content: `✅ Tópico aberto: ${threadTalk}`, ephemeral: true });
        }

        if (action === 'done') {
            if (player) await player.send(`✅ **Alpha Atendimento:** Seu caso foi analisado e marcado como **RESOLVIDO**.`).catch(() => {});
            await i.update({ content: `✅ **RESOLVIDO** por <@${i.user.id}>`, components: [], embeds: i.message.embeds });
            ticketCooldown.delete(targetId);
        }

        if (action === 'fail') {
            if (player) await player.send(`❌ **Alpha Atendimento:** Analisamos seu caso, mas não houve evidências suficientes.`).catch(() => {});
            await i.update({ content: `❌ **INSUFICIENTE** por <@${i.user.id}>`, components: [], embeds: i.message.embeds });
            ticketCooldown.delete(targetId);
        }
    }

    // --- FINALIZAÇÃO E TRANSCRIPT ---
    if (i.isButton() && i.customId.startsWith('audit_close_')) {
        const targetId = i.customId.split('_');
        const { filePath, fileName } = await generateAuditLog(i.channel, { tag: `id-${targetId}` });
        const logChan = i.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        if (logChan) await logChan.send({ content: `📁 Transcript:`, files: [new AttachmentBuilder(filePath)] });
        await i.reply('🔒 Encerrando...');
        setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); i.channel.delete().catch(() => {}); ticketCooldown.delete(targetId); }, 5000);
    }
});

client.login(TOKEN);
