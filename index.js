/**
 * 🎫 ALPHA TICKET SYSTEM - VERSÃO ULTRA BLINDADA 2026
 * Desenvolvido para máxima estabilidade no Railway.app
 * 
 * Funcionalidades: Tópicos Privados, Transcripts, Formulários Dinâmicos, 
 * Anti-Spam e Logs de Auditoria.
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

// --- CONFIGURAÇÕES DE AMBIENTE ---
const TOKEN = process.env.DISCORD_TOKEN;
const ID_CARGO_STAFF = '1452822605773148312'; 
const CANAL_TICKET_POST = '1476773027516518470';
const CANAL_LOGS_DENUNCIA = '1476775424540282934';

// Gerenciamento de Cooldown e Memória
const cooldowns = new Collection();

// --- TRATAMENTO DE ERROS GLOBAIS (ANTI-CRASH) ---
process.on('unhandledRejection', (reason, promise) => {
    console.error(' [ERRO] Rejeição não tratada em:', promise, 'motivo:', reason);
});
process.on('uncaughtException', (err) => {
    console.error(' [ERRO] Exceção não tratada:', err);
});

// --- REGISTRO DE COMANDOS ---
client.once('ready', async () => {
    console.log(`
    ================================================
    🚀 ALPHA SYSTEM ONLINE: ${client.user.tag}
    📅 Data: ${new Date().toLocaleString()}
    📊 Status: Monitorando Interações...
    ================================================
    `);

    const commands = [{
        name: 'setupsz',
        description: 'Posta o painel de tickets Alpha v2026',
        default_member_permissions: PermissionFlagsBits.Administrator.toString()
    }];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(' ✅ Comandos Slash registrados com sucesso!');
    } catch (error) { 
        console.error(' ❌ Erro ao registrar comandos:', error); 
    }
});

// --- MOTOR DE INTERAÇÕES ---
client.on('interactionCreate', async (interaction) => {
    
    // --- 1. COMANDO /SETUPSZ ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'setupsz') {
        if (interaction.channelId !== CANAL_TICKET_POST) {
            return interaction.reply({ content: `❌ Use este comando apenas em <#${CANAL_TICKET_POST}>`, ephemeral: true });
        }

        const embedPrincipal = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE ATENDIMENTO - ALPHA')
            .setDescription('Seja bem-vindo. Selecione a categoria desejada no menu abaixo para iniciar seu atendimento.\n\n🔒 **Segurança:** O processo de coleta é 100% privado.')
            .addFields(
                { name: '🔨 BAN / KICK', value: 'Denúncias de comportamento inadequado.', inline: true },
                { name: '🏆 SIMU', value: 'Problemas em simulados ou copas.', inline: true },
                { name: '💰 FALHA EM AP', value: 'Dúvidas ou problemas com pagamentos.', inline: true }
            )
            .setColor('#2b2d31')
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: 'Sistema Alpha • 2026', iconURL: client.user.displayAvatarURL() });

        const menuPrincipal = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('main_menu').setPlaceholder('Escolha a categoria principal...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'CAT_BAN', emoji: '🔨', description: 'Denunciar jogadores ou staff.' },
                    { label: 'SIMU (Simulados)', value: 'CAT_SIMU', emoji: '🏆', description: 'Relatar favoritismo ou erros em copas.' },
                    { label: 'FALHA EM AP', value: 'CAT_AP', emoji: '💰', description: 'Relatar problemas financeiros/pagamentos.' }
                ])
        );

        await interaction.reply({ content: '✅ Painel gerado com sucesso!', ephemeral: true });
        return interaction.channel.send({ embeds: [embedPrincipal], components: [menuPrincipal] });
    }

    // --- 2. CRIAÇÃO DE TÓPICO PRIVADO (COLETA) ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'main_menu') {
        // Anti-Spam
        if (cooldowns.has(interaction.user.id)) {
            return interaction.reply({ content: '⏳ Você já tem um ticket em andamento ou deve aguardar 30s.', ephemeral: true });
        }

        const categoria = interaction.values[0];
        
        try {
            const threadSolo = await interaction.channel.threads.create({
                name: `coleta-${categoria.toLowerCase()}-${interaction.user.username}`,
                type: ChannelType.PrivateThread,
                autoArchiveDuration: 60,
                reason: `Ticket de ${interaction.user.tag}`
            });

            await threadSolo.members.add(interaction.user.id);
            cooldowns.set(interaction.user.id, true);

            let subMenu;
            // --- SUB-CATEGORIAS BAN ---
            if (categoria === 'CAT_BAN') {
                subMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('sub_ban').setPlaceholder('BAN: O que ocorreu?')
                        .addOptions([
                            { label: 'Xingamento', value: 'sub_xing', emoji: '🤬' },
                            { label: 'Foto Inapropriada', value: 'sub_foto', emoji: '🔞' },
                            { label: 'Ameaça', value: 'sub_ameaca', emoji: '🚨' },
                            { label: 'Outro', value: 'sub_outro', emoji: '⚙️' }
                        ])
                );
            } 
            // --- SUB-CATEGORIAS SIMU ---
            else if (categoria === 'CAT_SIMU') {
                subMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('sub_simu').setPlaceholder('SIMU: O que ocorreu?')
                        .addOptions([
                            { label: 'Favoritismo', value: 'sub_favoritismo', emoji: '⭐' },
                            { label: 'Partidas Repetidas sem prova', value: 'sub_repetida', emoji: '🔁' }
                        ])
                );
            } 
            // --- SUB-CATEGORIAS AP ---
            else if (categoria === 'CAT_AP') {
                subMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('sub_ap').setPlaceholder('AP: O que ocorreu?')
                        .addOptions([
                            { label: 'Desrespeito', value: 'sub_desrespeito_ap', emoji: '😤' },
                            { label: 'Dinheiro pago errado', value: 'sub_pago_errado', emoji: '❌' },
                            { label: 'Valor não pago', value: 'sub_nao_pago', emoji: '📉' }
                        ])
                );
            }

            await threadSolo.send({ 
                content: `👋 Olá ${interaction.user}!\nVocê iniciou um atendimento para **${categoria.replace('CAT_', '')}**.\n\nEscolha o detalhe abaixo para abrir o formulário:`, 
                components: [subMenu] 
            });

            return interaction.reply({ content: `✅ Tópico privado de coleta criado: ${threadSolo}`, ephemeral: true });

        } catch (err) {
            console.error('Erro ao criar thread:', err);
            return interaction.reply({ content: '❌ Erro ao criar tópico. Verifique as permissões do bot.', ephemeral: true });
        }
    }

    // --- 3. FORMULÁRIOS DINÂMICOS (MODAIS) ---
    if (interaction.isStringSelectMenu()) {
        const sub = interaction.values[0];
        const menuId = interaction.customId;
        let modal;

        // RAMIFICAÇÃO BAN
        if (menuId === 'sub_ban') {
            modal = new ModalBuilder().setCustomId(`modal_final|BAN|${sub}`).setTitle(`DENÚNCIA BAN: ${sub}`);
            if (sub === 'sub_xing') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("QUEM FOI?").setPlaceholder("@batata").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("QUAL FOI A MENSAGEM?").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            } else if (sub === 'sub_foto') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("QUAL ERA O CONTEÚDO?").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            } else if (sub === 'sub_ameaca') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("QUAL A AMEAÇA? (TEM QUE TER PRINT)").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            } else {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("O QUE FOI O OCORRIDO?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("RELATE O OCORRIDO").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            }
        }

        // RAMIFICAÇÃO SIMU
        else if (menuId === 'sub_simu') {
            modal = new ModalBuilder().setCustomId(`modal_final|SIMU|${sub}`).setTitle(`DENÚNCIA SIMU: ${sub}`);
            if (sub === 'sub_favoritismo') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("QUEM FOI AJUDADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
                );
            } else {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("O QUE FOI FALADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("O QUE REALMENTE ACONTECEU?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c3').setLabel("QUEM FOI O MENTIROSO?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c4').setLabel("QUEM FOI O DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
                );
            }
        }

        // RAMIFICAÇÃO AP
        else if (menuId === 'sub_ap') {
            modal = new ModalBuilder().setCustomId(`modal_final|AP|${sub}`).setTitle(`DENÚNCIA AP: ${sub}`);
            if (sub === 'sub_desrespeito_ap') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("MENSAGEM?").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            } else if (sub === 'sub_pago_errado') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("VALOR PROPOSTO?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c3').setLabel("VALOR PAGO?").setStyle(TextInputStyle.Short).setRequired(true))
                );
            } else {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("QUAL O VALOR?").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c3').setLabel("PORQUE NÃO PAGOU?").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
            }
        }

        if (modal) return await interaction.showModal(modal);
    }

    // --- 4. PROCESSAMENTO FINAL E ENVIO PARA STAFF ---
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('modal_final|')) {
        const [_, cat, sub] = interaction.customId.split('|');
        const camposData = interaction.fields.fields.map(f => `**${f.label}:** ${f.value}`).join('\n');

        const embedStaff = new EmbedBuilder()
            .setTitle(`📂 RELATÓRIO RECEBIDO: ${cat}`)
            .setDescription(`**Denunciador:** <@${interaction.user.id}>\n**Sub-Tipo:** ${sub}\n\n${camposData}`)
            .setColor(cat === 'BAN' ? '#ff4d4d' : cat === 'AP' ? '#4dff4d' : '#4d4dff')
            .setTimestamp()
            .setThumbnail(interaction.user.displayAvatarURL());

        const logChannel = interaction.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        
        if (logChannel) {
            const logMsg = await logChannel.send({ 
                content: `🚨 **Novo Registro [${cat}]** | <@&${ID_CARGO_STAFF}>`, 
                embeds: [embedStaff] 
            });

            // Criar Tópico de Interação na Log
            const threadStaff = await logMsg.startThread({
                name: `${cat.toLowerCase()}-${interaction.user.username}`,
                autoArchiveDuration: 60,
                type: ChannelType.PublicThread
            });

            await threadStaff.members.add(interaction.user.id);
            
            const btnStaff = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_tkt').setLabel('ENCERRAR E ARQUIVAR').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await threadStaff.send({ 
                content: `👋 <@${interaction.user.id}>, seu relato foi processado.\nAguarde a equipe Staff <@&${ID_CARGO_STAFF}> responder abaixo.`,
                components: [btnStaff]
            });
        }

        await interaction.reply({ content: '✅ Relatório enviado com sucesso! A Staff te chamará no canal de logs.', ephemeral: true });
        
        // Deleta o tópico privado de coleta para não poluir
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        cooldowns.delete(interaction.user.id);
    }

    // --- 5. FECHAMENTO COM TRANSCRIPT ---
    if (interaction.isButton() && interaction.customId === 'close_tkt') {
        const thread = interaction.channel;
        
        await interaction.reply('🔒 Gerando transcript e encerrando atendimento...');

        // Lógica de Transcript Simplificada
        const messages = await thread.messages.fetch();
        let transcript = `TRANSCRIPT ALPHA - TICKET: ${thread.name}\n`;
        transcript += `Data: ${new Date().toLocaleString()}\n\n`;

        messages.reverse().forEach(m => {
            transcript += `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`;
        });

        const fileName = `transcript-${thread.id}.txt`;
        fs.writeFileSync(fileName, transcript);

        const attachment = new AttachmentBuilder(fileName);
        
        const logChannel = interaction.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        if (logChannel) {
            await logChannel.send({ 
                content: `📁 **Ticket Encerrado:** \`${thread.name}\`\nAutor: <@${interaction.user.id}>`, 
                files: [attachment] 
            });
        }

        // Limpa o arquivo local
        setTimeout(() => {
            fs.unlinkSync(fileName);
            thread.delete().catch(() => {});
        }, 5000);
    }
});

client.login(TOKEN);
