/**
 * 🎫 ALPHA TICKET SYSTEM - ULTIMATE EDITION 2026
 * Sistema focado em Tópicos Privados, Transcripts e Segurança Industrial.
 * Suporte Total para Railway.app
 */

const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, REST, Routes,
    Collection, AttachmentBuilder
} = require('discord.js');
const fs = require('fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ] 
});

// --- VARIÁVEIS DE AMBIENTE ---
const TOKEN = process.env.DISCORD_TOKEN;
const ID_CARGO_STAFF = '1452822605773148312'; 
const CANAL_TICKET_POST = '1476773027516518470';
const CANAL_LOGS_DENUNCIA = '1476775424540282934';

// --- SISTEMAS INTERNOS ---
const ticketState = new Collection(); 
const antiSpam = new Collection();
const logQueue = new Collection();

// --- TRATAMENTO DE ERROS GLOBAIS ---
process.on('unhandledRejection', (reason, promise) => {
    console.error(' [ERRO FATAL] Rejeição não tratada:', reason);
});

client.once('ready', async () => {
    console.log(`
    ███████╗███████╗████████╗██╗   ██╗██████╗ 
    ██╔════╝██╔════╝╚══██╔══╝██║   ██║██╔══██╗
    ███████╗█████╗     ██║   ██║   ██║██████╔╝
    ╚════██║██╔══╝     ██║   ██║   ██║██╔═══╝ 
    ███████║███████╗   ██║   ╚██████╔╝██║     
    ╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝     
    BOT ALPHA ONLINE - ${client.user.tag}
    `);

    const commands = [{
        name: 'setupsz',
        description: 'Posta o painel industrial de tickets Alpha',
        default_member_permissions: PermissionFlagsBits.Administrator.toString()
    }];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(' ✅ Comandos Slash registrados no Discord API.');
    } catch (e) { console.error(' ❌ Falha ao registrar comandos:', e); }
});

client.on('interactionCreate', async (interaction) => {
    
    // --- 1. COMANDO DE SETUP (PAINEL PRINCIPAL) ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'setupsz') {
        if (interaction.channelId !== CANAL_TICKET_POST) {
            return interaction.reply({ content: `❌ Este comando deve ser usado apenas em <#${CANAL_TICKET_POST}>`, ephemeral: true });
        }

        const embedSetup = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE ATENDIMENTO - ALPHA')
            .setDescription(`
            Precisa de ajuda ou deseja realizar uma denúncia?
            Siga os passos abaixo para garantir seu atendimento:
            
            1️⃣ **Selecione a Categoria** no menu abaixo.
            2️⃣ **Clique no Botão Verde** para iniciar.
            3️⃣ **Preencha o formulário** no tópico privado.
            
            🔒 *Sua privacidade é nossa prioridade.*
            `)
            .setColor('#2b2d31')
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: 'Alpha Security • Atendimento 24h', iconURL: client.user.displayAvatarURL() });

        const menuPrincipal = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('main_selector').setPlaceholder('Selecione o assunto do ticket...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'CAT_BAN', emoji: '🔨', description: 'Denunciar comportamento ou infrações.' },
                    { label: 'SIMU (Simulados)', value: 'CAT_SIMU', emoji: '🏆', description: 'Erros em copas ou favoritismo.' },
                    { label: 'FALHA EM AP', value: 'CAT_AP', emoji: '💰', description: 'Problemas com pagamentos ou valores.' }
                ])
        );

        const btnAbertura = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('trigger_open').setLabel('INICIAR ATENDIMENTO').setStyle(ButtonStyle.Success).setEmoji('📩')
        );

        await interaction.reply({ content: '✅ Painel gerado!', ephemeral: true });
        return interaction.channel.send({ embeds: [embedSetup], components: [menuPrincipal, btnAbertura] });
    }

    // --- 2. CAPTURA DE SELEÇÃO E CACHE ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'main_selector') {
        ticketState.set(interaction.user.id, interaction.values[0]);
        return interaction.reply({ content: `✅ Você selecionou: **${interaction.values[0].replace('CAT_', '')}**. Clique em **INICIAR ATENDIMENTO** para prosseguir.`, ephemeral: true });
    }

    // --- 3. ABERTURA DO TÓPICO DE COLETA PRIVADO ---
    if (interaction.isButton() && interaction.customId === 'trigger_open') {
        const cat = ticketState.get(interaction.user.id);
        
        if (!cat) {
            return interaction.reply({ content: '❌ Erro: Selecione uma categoria no menu primeiro!', ephemeral: true });
        }

        if (antiSpam.has(interaction.user.id)) {
            return interaction.reply({ content: '⏳ Você já possui um atendimento ativo ou está em cooldown.', ephemeral: true });
        }

        try {
            const threadSolo = await interaction.channel.threads.create({
                name: `coleta-${interaction.user.username}`,
                type: ChannelType.PrivateThread,
                autoArchiveDuration: 60,
                reason: `Ticket Alpha de ${interaction.user.tag}`
            });

            await threadSolo.members.add(interaction.user.id);
            antiSpam.set(interaction.user.id, true);

            // Interface dentro do Tópico Privado
            let rowMenuSub;
            if (cat === 'CAT_BAN') {
                rowMenuSub = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('sub_ban_select').setPlaceholder('BAN: Detalhe o ocorrido...')
                        .addOptions([
                            { label: 'Xingamento', value: 'Xingamento', emoji: '🤬' },
                            { label: 'Foto Inapropriada', value: 'Foto Inapropriada', emoji: '🔞' },
                            { label: 'Ameaça', value: 'Ameaça', emoji: '🚨' },
                            { label: 'Outro', value: 'Outro', emoji: '⚙️' }
                        ])
                );
            } else if (cat === 'CAT_SIMU') {
                rowMenuSub = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('sub_simu_select').setPlaceholder('SIMU: Detalhe o ocorrido...')
                        .addOptions([
                            { label: 'Favoritismo', value: 'Favoritismo', emoji: '⭐' },
                            { label: 'Partidas Repetidas sem prova', value: 'Partidas Repetidas', emoji: '🔁' }
                        ])
                );
            } else if (cat === 'CAT_AP') {
                rowMenuSub = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('sub_ap_select').setPlaceholder('AP: Detalhe o ocorrido...')
                        .addOptions([
                            { label: 'Desrespeito', value: 'Desrespeito', emoji: '😤' },
                            { label: 'Dinheiro pago errado', value: 'Dinheiro Errado', emoji: '❌' },
                            { label: 'Valor não pago', value: 'Valor não pago', emoji: '📉' }
                        ])
                );
            }

            const btnCancel = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cancel_ticket').setLabel('CANCELAR ATENDIMENTO').setStyle(ButtonStyle.Danger).setEmoji('✖️')
            );

            await threadSolo.send({ 
                content: `👋 Olá ${interaction.user}, você iniciou um ticket de **${cat.replace('CAT_', '')}**.\n\nEscolha o motivo específico abaixo para liberar o formulário ou cancele se desejar.`,
                components: [rowMenuSub, btnCancel] 
            });

            return interaction.reply({ content: `✅ Tópico de coleta privado aberto: ${threadSolo}`, ephemeral: true });

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: '❌ Falha ao criar tópico. O bot precisa da permissão "Gerenciar Tópicos".', ephemeral: true });
        }
    }

    // --- 4. BOTÃO CANCELAR (DENTRO DO TÓPICO) ---
    if (interaction.isButton() && interaction.customId === 'cancel_ticket') {
        antiSpam.delete(interaction.user.id);
        await interaction.reply('🔒 Cancelando e deletando tópico...');
        return setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }

    // --- 5. DISPARO DOS FORMULÁRIOS (MODAIS) ---
    if (interaction.isStringSelectMenu()) {
        const sub = interaction.values[0];
        const mid = interaction.customId;
        let modal;

        // RAMIFICAÇÃO BAN
        if (mid === 'sub_ban_select') {
            modal = new ModalBuilder().setCustomId(`modal_f|BAN|${sub}`).setTitle(`BAN: ${sub}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f1').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f2').setLabel(sub === 'Xingamento' ? "QUAL FOI A MENSAGEM?" : "RELATE O CASO").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        }
        // RAMIFICAÇÃO SIMU
        else if (mid === 'sub_simu_select') {
            modal = new ModalBuilder().setCustomId(`modal_f|SIMU|${sub}`).setTitle(`SIMU: ${sub}`);
            if (sub === 'Favoritismo') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f1').setLabel("QUEM FOI AJUDADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f2').setLabel("DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
                );
            } else {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f1').setLabel("O QUE FOI FALADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f2').setLabel("O QUE ACONTECEU?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f3').setLabel("QUEM FOI O MENTIROSO?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f4').setLabel("DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
                );
            }
        }
        // RAMIFICAÇÃO AP
        else if (mid === 'sub_ap_select') {
            modal = new ModalBuilder().setCustomId(`modal_f|AP|${sub}`).setTitle(`AP: ${sub}`);
            if (sub === 'Desrespeito') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f1').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f2').setLabel("QUAL FOI A MENSAGEM?").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            } else if (sub === 'Dinheiro Errado') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f1').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f2').setLabel("QUAL VALOR PROPOSTO?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f3').setLabel("QUAL VALOR PAGO?").setStyle(TextInputStyle.Short).setRequired(true))
                );
            } else {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f1').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f2').setLabel("VALOR?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f3').setLabel("PORQUE NÃO PAGOU?").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            }
        }

        if (modal) return await interaction.showModal(modal);
    }

    // --- 6. RECEBIMENTO DO MODAL E ENVIO PARA STAFF ---
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('modal_f|')) {
        const [_, cat, sub] = interaction.customId.split('|');
        const fields = interaction.fields.fields.map(f => `**${f.label}:** ${f.value}`).join('\n');

        const embedStaffLog = new EmbedBuilder()
            .setTitle(`📂 NOVA DENÚNCIA REGISTRADA: ${cat}`)
            .setDescription(`**Denunciador:** <@${interaction.user.id}>\n**Categoria:** ${cat}\n**Subcategoria:** ${sub}\n\n${fields}`)
            .setColor(cat === 'BAN' ? '#ff4b4b' : cat === 'AP' ? '#4bff4b' : '#4b4bff')
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();

        const logChannel = interaction.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        if (logChannel) {
            const msgLog = await logChannel.send({ 
                content: `🚨 **NOVO TICKET [${cat}]** | <@&${ID_CARGO_STAFF}>`, 
                embeds: [embedStaffLog] 
            });

            // Criar Tópico de Interação na Log
            const threadStaff = await msgLog.startThread({
                name: `${cat.toLowerCase()}-${interaction.user.username}`,
                autoArchiveDuration: 60,
                type: ChannelType.PublicThread
            });

            await threadStaff.members.add(interaction.user.id);
            
            const btnStaffActions = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('finalize_tkt').setLabel('ENCERRAR E GERAR LOG').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await threadStaff.send({ 
                content: `👋 <@${interaction.user.id}>, seu relato foi enviado para a equipe Alpha.\nInteraja com a Staff por aqui.\n\n🛠️ **Painel Staff:**`,
                components: [btnStaffActions]
            });
        }

        await interaction.reply({ content: '✅ Seu relatório foi enviado com sucesso! Verifique a aba de tópicos no canal de logs para falar com a Staff.', ephemeral: true });
        
        // Limpeza do tópico de coleta
        setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
        antiSpam.delete(interaction.user.id);
    }

    // --- 7. FINALIZAÇÃO E TRANSCRIPT (AUDITORIA) ---
    if (interaction.isButton() && interaction.customId === 'finalize_tkt') {
        const thread = interaction.channel;
        
        await interaction.reply('🔒 Gerando transcript e encerrando atendimento em 5 segundos...');

        // Lógica de Geração de Log Detalhado
        const messages = await thread.messages.fetch({ limit: 100 });
        let logData = `ALPHA SYSTEM - AUDITORIA DE TICKET\n`;
        logData += `Canal: ${thread.name}\nData: ${new Date().toLocaleString()}\n`;
        logData += `--------------------------------------------------\n\n`;

        messages.reverse().forEach(m => {
            logData += `[${m.createdAt.toLocaleTimeString()}] ${m.author.tag}: ${m.cleanContent || "[MENSAGEM COM EMBED/MIDIA]"}\n`;
        });

        const logFileName = `transcript-${thread.id}.txt`;
        fs.writeFileSync(logFileName, logData);

        const attachment = new AttachmentBuilder(logFileName);
        const auditChannel = interaction.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        
        if (auditChannel) {
            await auditChannel.send({ 
                content: `📁 **Ticket Arquivado:** \`${thread.name}\`\nEncerrado por: <@${interaction.user.id}>`, 
                files: [attachment] 
            });
        }

        // Limpeza final do arquivo e canal
        setTimeout(() => {
            fs.unlinkSync(logFileName);
            thread.delete().catch(() => {});
        }, 5000);
    }
});

client.login(TOKEN);
