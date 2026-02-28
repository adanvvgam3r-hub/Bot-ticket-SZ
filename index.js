// ALPHA SUPREME TICKET SYSTEM - VERSÃO INDUSTRIAL 2026
// Focado em Tópicos Privados, Transcripts e Decisão da Staff
// Desenvolvido para Railway.app

const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, REST, Routes,
    Collection, AttachmentBuilder, ActivityType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Inicialização do Cliente com Intents Necessárias
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ] 
});

// Configurações Estáticas e Variáveis de Ambiente
const TOKEN = process.env.DISCORD_TOKEN;
const ID_CARGO_STAFF = '1452822605773148312'; 
const CANAL_TICKET_POST = '1476773027516518470';
const CANAL_LOGS_DENUNCIA = '1476775424540282934';

// Gerenciadores de Estado (Database em Memória para Estabilidade)
const ticketSessions = new Collection();
const activeColetas = new Collection();
const globalCooldown = new Collection();
const staffMetrics = new Collection();
const interactionLogs = new Collection();

// Handler de Erros Global para evitar quedas no Railway
process.on('unhandledRejection', (reason, promise) => {
    console.error(' [ERRO DE PROMESSA] ', reason);
});

process.on('uncaughtException', (err) => {
    console.error(' [ERRO DE EXCEÇÃO] ', err);
});

// Função de Transcript Industrial para Auditoria
async function createIndustrialTranscript(channel, user) {
    const messages = await channel.messages.fetch({ limit: 100 });
    let content = `RELATÓRIO DE AUDITORIA ALPHA - TICKET ${channel.name}\n`;
    content += `Data: ${new Date().toLocaleString()}\n`;
    content += `Usuário: ${user.tag} (${user.id})\n`;
    content += `--------------------------------------------------\n\n`;

    messages.reverse().forEach(m => {
        const time = m.createdAt.toLocaleTimeString();
        content += `[${time}] ${m.author.tag}: ${m.cleanContent || "[Embed/Midia]"}\n`;
        if (m.attachments.size > 0) {
            m.attachments.forEach(a => content += ` > ANEXO: ${a.url}\n`);
        }
    });

    const fileName = `transcript-${channel.id}.txt`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, content);
    return { filePath, fileName };
}

// Inicialização do Bot
client.once('ready', async () => {
    console.log(`[ALPHA] Conectado como ${client.user.tag}`);
    client.user.setActivity('Alpha Supreme 2026', { type: ActivityType.Competing });

    const commands = [{
        name: 'setupsz',
        description: 'Posta o painel supremo de tickets Alpha',
        default_member_permissions: PermissionFlagsBits.Administrator.toString()
    }];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[ALPHA] Comandos Slash Sincronizados.');
    } catch (e) {
        console.error('[ALPHA] Erro Rest:', e);
    }
});

// Listener Principal de Interações
client.on('interactionCreate', async (i) => {
    
    // COMANDO DE SETUP
    if (i.isChatInputCommand() && i.commandName === 'setupsz') {
        if (i.channelId !== CANAL_TICKET_POST) {
            return i.reply({ content: `❌ Use em <#${CANAL_TICKET_POST}>`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE ATENDIMENTO - ALPHA')
            .setDescription('Selecione a categoria e clique no botão para iniciar.\n\n🔒 **Privacidade:** A primeira etapa é um tópico privado entre você e o bot.')
            .setColor('#2b2d31')
            .setFooter({ text: 'Alpha Supreme System' });

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('main_select').setPlaceholder('Escolha a categoria principal...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'CAT_BAN', emoji: '🔨' },
                    { label: 'SIMU (Simulados)', value: 'CAT_SIMU', emoji: '🏆' },
                    { label: 'FALHA EM AP', value: 'CAT_AP', emoji: '💰' }
                ])
        );

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('init_coleta').setLabel('ABRIR TICKET').setStyle(ButtonStyle.Success).setEmoji('📩')
        );

        await i.reply({ content: '✅ Painel configurado!', ephemeral: true });
        return i.channel.send({ embeds: [embed], components: [menu, btn] });
    }

    // CACHE DE SELEÇÃO INICIAL
    if (i.isStringSelectMenu() && i.customId === 'main_select') {
        ticketSessions.set(i.user.id, i.values[0]);
        return i.reply({ content: `✅ Categoria **${i.values[0].replace('CAT_', '')}** selecionada!`, ephemeral: true });
    }

    // ABERTURA DO TÓPICO DE COLETA PRIVADO (SÓ USER + BOT)
    if (i.isButton() && i.customId === 'init_coleta') {
        const cat = ticketSessions.get(i.user.id);
        if (!cat) return i.reply({ content: '❌ Selecione uma categoria no menu primeiro!', ephemeral: true });

        if (globalCooldown.has(i.user.id)) {
            return i.reply({ content: '⏳ Você já tem um atendimento pendente.', ephemeral: true });
        }

        try {
            const threadSolo = await i.channel.threads.create({
                name: `coleta-${i.user.username}`,
                type: ChannelType.PrivateThread,
                autoArchiveDuration: 60
            });

            await threadSolo.members.add(i.user.id);
            activeColetas.set(i.user.id, threadSolo.id);
            globalCooldown.set(i.user.id, Date.now());

            // Menu de Subcategorias Dinâmico
            let rowSub;
            if (cat === 'CAT_BAN') {
                rowSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_ban').setPlaceholder('BAN: Detalhe o ocorrido...')
                    .addOptions([
                        { label: 'Xingamento', value: 'Xingamento', emoji: '🤬' },
                        { label: 'Foto Inapropriada', value: 'Foto Inapropriada', emoji: '🔞' },
                        { label: 'Ameaça', value: 'Ameaça', emoji: '🚨' },
                        { label: 'Outro', value: 'Outro', emoji: '⚙️' }
                    ]));
            } else if (cat === 'CAT_SIMU') {
                rowSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_simu').setPlaceholder('SIMU: Detalhe o ocorrido...')
                    .addOptions([
                        { label: 'Favoritismo', value: 'Favoritismo', emoji: '⭐' },
                        { label: 'Partidas Repetidas sem prova', value: 'Partidas Repetidas', emoji: '🔁' }
                    ]));
            } else if (cat === 'CAT_AP') {
                rowSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_ap').setPlaceholder('AP: Detalhe o ocorrido...')
                    .addOptions([
                        { label: 'Desrespeito', value: 'Desrespeito', emoji: '😤' },
                        { label: 'Dinheiro pago errado', value: 'Dinheiro Errado', emoji: '❌' },
                        { label: 'Valor não pago', value: 'Valor não pago', emoji: '📉' }
                    ]));
            }

            const btnCancel = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cancel_now').setLabel('CANCELAR').setStyle(ButtonStyle.Danger));

            await threadSolo.send({ 
                content: `👋 Olá ${i.user}! Este é seu espaço privado para enviar dados de **${cat.replace('CAT_', '')}**.\nEscolha o motivo específico:`, 
                components: [rowSub, btnCancel] 
            });

            return i.reply({ content: `✅ Tópico de coleta iniciado: ${threadSolo}`, ephemeral: true });
        } catch (e) {
            console.error(e);
            return i.reply({ content: '❌ Erro ao criar tópico. Verifique permissões.', ephemeral: true });
        }
    }

    // BOTÃO DE CANCELAR COLETA
    if (i.isButton() && i.customId === 'cancel_now') {
        globalCooldown.delete(i.user.id);
        await i.reply('🔒 Encerrando coleta...');
        return setTimeout(() => i.channel.delete().catch(() => {}), 2000);
    }

    // DISPARO DE MODAIS (FORMULÁRIOS)
    if (i.isStringSelectMenu() && i.customId.startsWith('sub_')) {
        const sub = i.values[0];
        const cat = i.customId.replace('sub_', '').toUpperCase();
        let modal = new ModalBuilder().setCustomId(`form_final|${cat}|${sub}`).setTitle(`${cat}: ${sub}`);

        // Lógica de Campos Específicos para cada Subcategoria
        if (sub === 'Xingamento' || sub === 'Desrespeito') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel("QUAL FOI A MENSAGEM?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (sub === 'Foto Inapropriada') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel("CONTEÚDO DA FOTO?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (sub === 'Ameaça') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel("QUAL A AMEAÇA? (TEM QUE TER PRINT)").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (sub === 'Favoritismo') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("QUEM FOI AJUDADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (sub === 'Partidas Repetidas') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("O QUE FOI FALADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("O QUE ACONTECEU?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c3').setLabel("MENTIROSO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c4').setLabel("DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (sub === 'Dinheiro Errado') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v1').setLabel("VALOR PROPOSTO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v2').setLabel("VALOR PAGO?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (sub === 'Valor não pago') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v').setLabel("VALOR?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel("MOTIVO DO NÃO PAGAMENTO?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q').setLabel("O QUE OCORREU?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel("RELATE OS DETALHES").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        }

        return await i.showModal(modal);
    }

    // PROCESSAMENTO DO FORMULÁRIO E ENVIO PARA STAFF (DECISÃO)
    if (i.type === InteractionType.ModalSubmit && i.customId.startsWith('form_final|')) {
        const [_, cat, sub] = i.customId.split('|');
        const formData = i.fields.fields.map(f => `**${f.label}:** ${f.value}`).join('\n');

        const embedDecision = new EmbedBuilder()
            .setTitle(`📂 RECEBIMENTO: ${cat}`)
            .setDescription(`**Denunciador:** <@${i.user.id}>\n**Motivo:** ${sub}\n\n**Dados do Relatório:**\n${formData}`)
            .setColor('#f1c40f')
            .setTimestamp()
            .setThumbnail(i.user.displayAvatarURL());

        const rowDecision = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`decide_talk_${i.user.id}`).setLabel('INTERAGIR').setStyle(ButtonStyle.Primary).setEmoji('💬'),
            new ButtonBuilder().setCustomId(`decide_done_${i.user.id}`).setLabel('RESOLVIDO').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId(`decide_fail_${i.user.id}`).setLabel('INSUFICIENTE').setStyle(ButtonStyle.Danger).setEmoji('❌')
        );

        const logChan = i.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        if (logChan) {
            await logChan.send({ content: `🚨 **Revisão Pendente [${cat}]** | <@&${ID_CARGO_STAFF}>`, embeds: [embedDecision], components: [rowDecision] });
        }

        await i.reply({ content: '✅ Relatório enviado! A Staff analisará sua denúncia. Aguarde a decisão ou o contato por um novo tópico no canal de logs.', ephemeral: true });
        
        // Deleta o tópico de coleta imediatamente
        const coletaThreadId = activeColetas.get(i.user.id);
        if (coletaThreadId) {
            const t = i.guild.channels.cache.get(coletaThreadId);
            if (t) setTimeout(() => t.delete().catch(() => {}), 2000);
            activeColetas.delete(i.user.id);
        }
    }

    // LÓGICA DE DECISÃO DA STAFF (INTERAGIR / RESOLVER / RECUSAR)
    if (i.isButton() && i.customId.startsWith('decide_')) {
        const [_, action, targetId] = i.customId.split('_');
        const targetUser = await client.users.fetch(targetId).catch(() => null);

        // CASO 1: INTERAGIR (ABRE TÓPICO DE CONVERSA)
        if (action === 'talk') {
            const threadInteracao = await i.channel.threads.create({
                name: `atendimento-${targetId}`,
                type: ChannelType.PublicThread,
                autoArchiveDuration: 60
            });

            await threadInteracao.members.add(targetId);
            
            const btnStaffClose = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`finalize_audit_${targetId}`).setLabel('ENCERRAR E GERAR LOG').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await threadInteracao.send({ 
                content: `👋 <@${targetId}>, a Staff <@${i.user.id}> iniciou esta conversa sobre sua denúncia.\n\n🛠️ **Para Staff:** Use o botão abaixo ao finalizar.`,
                components: [btnStaffClose]
            });

            return i.reply({ content: `✅ Tópico de interação criado: ${threadInteracao}`, ephemeral: true });
        }

        // CASO 2: RESOLVIDO (DM DIRETA)
        if (action === 'done') {
            if (targetUser) {
                await targetUser.send(`✅ **Alpha Atendimento:** Seu caso foi analisado pela equipe e foi considerado **RESOLVIDO**.`).catch(() => {});
            }
            await i.update({ content: `✅ **CASO RESOLVIDO** por <@${i.user.id}>`, components: [], embeds: i.message.embeds });
            globalCooldown.delete(targetId);
        }

        // CASO 3: INSUFICIENTE (DM DIRETA)
        if (action === 'fail') {
            if (targetUser) {
                await targetUser.send(`❌ **Alpha Atendimento:** Analisamos sua denúncia, mas não encontramos evidências suficientes ou provas concretas. Caso encerrado.`).catch(() => {});
            }
            await i.update({ content: `❌ **RECUSADO (PROVAS INSUFICIENTES)** por <@${i.user.id}>`, components: [], embeds: i.message.embeds });
            globalCooldown.delete(targetId);
        }
    }

    // FINALIZAÇÃO DE AUDITORIA E TRANSCRIPT
    if (i.isButton() && i.customId.startsWith('finalize_audit_')) {
        const targetUserId = i.customId.split('_')[2];
        const thread = i.channel;
        
        await i.reply('🔒 Arquivando atendimento e gerando transcript...');

        const targetUser = await client.users.fetch(targetUserId).catch(() => ({ tag: 'Desconhecido', id: targetUserId }));
        const { filePath, fileName } = await createIndustrialTranscript(thread, targetUser);
        const attachment = new AttachmentBuilder(filePath);

        const auditChannel = i.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        if (auditChannel) {
            await auditChannel.send({ 
                content: `📁 **Ticket Encerrado:** \`${thread.name}\`\nFinalizado por: <@${i.user.id}>`, 
                files: [attachment] 
            });
        }

        setTimeout(() => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            thread.delete().catch(() => {});
            globalCooldown.delete(targetUserId);
        }, 5000);
    }
});

// LOGIN DO BOT NO RAILWAY
client.login(TOKEN);

// NOTAS TÉCNICAS PARA O RAILWAY:
// 1. O sistema de Transcripts usa o sistema de arquivos local do Railway para processamento temporário.
// 2. Os limites de taxa (Rate Limits) do Discord são gerenciados pelo tempo de deleção de tópicos.
// 3. Este código utiliza as versões mais recentes do discord.js (v14+) para garantir compatibilidade.
