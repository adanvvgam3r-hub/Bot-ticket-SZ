const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, REST, Routes,
    Collection
} = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers
    ] 
});

// --- CONFIGURAÇÃO DE AMBIENTE ---
const TOKEN = process.env.DISCORD_TOKEN;
const ID_STAFF = '1453126709447754010';
const ID_CATEGORIA = process.env.ID_CATEGORIA; 
const CANAL_TICKET_POST = '1476773027516518470';
const CANAL_LOGS_DENUNCIA = '1476775424540282934';

// Cache em memória para evitar bugs de seleção
const ticketCache = new Collection();

// --- REGISTRO DE COMANDOS ---
client.once('ready', async () => {
    console.log(`
    ==========================================
    🚀 TICKET-SZ ALPHA ONLINE
    🤖 Bot: ${client.user.tag}
    📊 Status: Operacional
    ==========================================
    `);

    const commands = [
        {
            name: 'setupsz',
            description: 'Posta o painel de atendimento unificado',
            default_member_permissions: PermissionFlagsBits.Administrator.toString()
        },
        {
            name: 'limpar-atendimento',
            description: 'Remove canais de tickets antigos da categoria',
            default_member_permissions: PermissionFlagsBits.Administrator.toString()
        }
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Comandos Slash registrados com sucesso!');
    } catch (error) { 
        console.error('❌ Erro ao registrar comandos:', error); 
    }
});

// --- GERENCIADOR DE INTERAÇÕES ---
client.on('interactionCreate', async (i) => {
    
    // 1. COMANDO DE SETUP
    if (i.isChatInputCommand() && i.commandName === 'setupsz') {
        if (i.channelId !== CANAL_TICKET_POST) {
            return i.reply({ content: `❌ Comando permitido apenas em <#${CANAL_TICKET_POST}>`, ephemeral: true });
        }

        const embedPrincipal = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE ATENDIMENTO - ALPHA')
            .setDescription(`
            Seja bem-vindo à nossa central de suporte.
            
            **Como funciona?**
            1️⃣ Selecione o tipo de ocorrido no menu.
            2️⃣ Clique em **ABRIR TICKET**.
            3️⃣ Preencha o formulário que aparecerá.
            
            ⚠️ *Abuso deste sistema resultará em punição.*
            `)
            .setColor('#2b2d31')
            .setThumbnail(i.guild.iconURL())
            .setFooter({ text: 'Sistema Alpha v2.0', iconURL: client.user.displayAvatarURL() });

        const menuCategorias = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('selecionar_tipo')
                .setPlaceholder('Selecione o motivo do contato...')
                .addOptions([
                    { label: 'DENÚNCIA (BAN/KICK)', description: 'Reportar infrações graves', value: 'cat_ban', emoji: '🔨' },
                    { label: 'FALHA EM AP', description: 'Problemas com pagamentos ou vitórias', value: 'cat_ap', emoji: '💰' },
                    { label: 'FALHA EM SIMULADO', description: 'Erros em competições simuladas', value: 'cat_simu', emoji: '🏆' },
                    { label: 'OUTROS ASSUNTOS', description: 'Dúvidas gerais', value: 'cat_outro', emoji: '📩' }
                ])
        );

        const botaoAbrir = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_abrir_ticket')
                .setLabel('ABRIR TICKET')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🚀')
        );

        await i.reply({ content: '✅ Painel gerado com sucesso.', ephemeral: true });
        return i.channel.send({ embeds: [embedPrincipal], components: [menuCategorias, botaoAbrir] });
    }

    // 2. CAPTURA DA SELEÇÃO DO MENU
    if (i.isStringSelectMenu() && i.customId === 'selecionar_tipo') {
        ticketCache.set(i.user.id, i.values[0]);
        return i.reply({ content: `✅ Categoria **${i.values[0].replace('cat_', '').toUpperCase()}** selecionada!`, ephemeral: true });
    }

    // 3. BOTÃO DE ABRIR TICKET
    if (i.isButton() && i.customId === 'btn_abrir_ticket') {
        const categoriaSelecionada = ticketCache.get(i.user.id);
        
        if (!categoriaSelecionada) {
            return i.reply({ content: '❌ Por favor, **selecione uma categoria** no menu acima primeiro!', ephemeral: true });
        }

        // Criar Canal
        const nomeCanal = `tkt-${i.user.username}`;
        try {
            const canal = await i.guild.channels.create({
                name: nomeCanal,
                type: ChannelType.GuildText,
                parent: ID_CATEGORIA,
                permissionOverwrites: [
                    { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: ID_STAFF, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            // Menu de Sub-Ocorrido dentro do canal
            let opcoesSub = [];
            if (categoriaSelecionada === 'cat_ban') {
                opcoesSub = [{ label: 'Xingamento', value: 'sub_xing' }, { label: 'Mídia Inapropriada', value: 'sub_midia' }, { label: 'Ameaça', value: 'sub_ameaca' }];
            } else {
                opcoesSub = [{ label: 'Vitória Errada', value: 'sub_vit' }, { label: 'Pagamento Errado', value: 'sub_pag' }, { label: 'Outro', value: 'sub_outro' }];
            }

            const rowSub = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('sub_ocorrido').setPlaceholder('Especifique o ocorrido...').addOptions(opcoesSub)
            );

            const embedBoasVindas = new EmbedBuilder()
                .setTitle(`🏠 SUPORTE: ${categoriaSelecionada.replace('cat_', '').toUpperCase()}`)
                .setDescription(`Olá ${i.user}, para prosseguirmos, selecione o detalhe abaixo e preencha o formulário.`)
                .setColor('#5865F2');

            await canal.send({ content: `${i.user} | <@&${ID_STAFF}>`, embeds: [embedBoasVindas], components: [rowSub] });
            await i.reply({ content: `✅ Ticket criado: ${canal}`, ephemeral: true });

        } catch (err) {
            console.error(err);
            return i.reply({ content: '❌ Erro ao criar canal. Verifique as permissões do bot.', ephemeral: true });
        }
    }

    // 4. MODAL DE DETALHES
    if (i.isStringSelectMenu() && i.customId === 'sub_ocorrido') {
        const modal = new ModalBuilder().setCustomId('modal_final').setTitle('RELATÓRIO FINAL');
        
        const inputQuem = new TextInputBuilder()
            .setCustomId('input_quem')
            .setLabel("QUEM É O ACUSADO/ENVOLVIDO?")
            .setPlaceholder("Ex: @picles ou @batata")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const inputRelato = new TextInputBuilder()
            .setCustomId('input_relato')
            .setLabel("DESCRIÇÃO DOS FATOS")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(inputQuem), new ActionRowBuilder().addComponents(inputRelato));
        return await i.showModal(modal);
    }

    // 5. RECEBIMENTO DO MODAL E LOGS
    if (i.type === InteractionType.ModalSubmit && i.customId === 'modal_final') {
        const quem = i.fields.getTextInputValue('input_quem');
        const relato = i.fields.getTextInputValue('input_relato');

        const embedLog = new EmbedBuilder()
            .setTitle('📂 NOVA DENÚNCIA REGISTRADA')
            .setColor('#f1c40f')
            .addFields(
                { name: '👤 Denunciador', value: `${i.user} (\`${i.user.id}\`)`, inline: true },
                { name: '👤 Acusado', value: `\`${quem}\``, inline: true },
                { name: '📝 Relato', value: relato }
            )
            .setTimestamp();

        const btnStaff = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`abrir_thread_${i.user.id}`).setLabel('ABRIR TÓPICO PRIVADO').setStyle(ButtonStyle.Primary).setEmoji('💬'),
            new ButtonBuilder().setCustomId(`notificar_resolvido_${i.user.id}`).setLabel('RESOLVIDO').setStyle(ButtonStyle.Success).setEmoji('✅')
        );

        const canalLog = i.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        if (canalLog) await canalLog.send({ embeds: [embedLog], components: [btnStaff] });

        const btnFechar = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('fechar_tkt_agora').setLabel('FECHAR TICKET').setStyle(ButtonStyle.Danger)
        );

        await i.reply({ content: '✅ Relatório enviado! A equipe analisará as provas.', embeds: [embedLog], components: [btnFechar] });
    }

    // 6. TÓPICO PRIVADO (THREADS)
    if (i.isButton() && i.customId.startsWith('abrir_thread_')) {
        const targetId = i.customId.split('_')[2];
        const thread = await i.channel.threads.create({
            name: `atendimento-${targetId}`,
            type: ChannelType.PrivateThread,
            autoArchiveDuration: 60
        });
        
        await thread.members.add(targetId);
        await i.reply({ content: `✅ Tópico privado criado: ${thread}`, ephemeral: true });
        await thread.send(`⚠️ <@${targetId}>, a Staff iniciou uma investigação privada sobre seu caso aqui.`);
    }

    // 7. NOTIFICAÇÃO DM E FECHAMENTO
    if (i.isButton() && i.customId.startsWith('notificar_resolvido_')) {
        const targetId = i.customId.split('_')[2];
        try {
            const user = await client.users.fetch(targetId);
            await user.send('⭐ **Seu ticket foi marcado como RESOLVIDO!** Caso precise de mais ajuda, abra um novo chamado.');
            await i.reply({ content: '✅ Usuário notificado via DM.', ephemeral: true });
        } catch {
            await i.reply({ content: '⚠️ DM do usuário está fechada, mas marquei como resolvido.', ephemeral: true });
        }
    }

    if (i.isButton() && i.customId === 'fechar_tkt_agora') {
        await i.reply('🔒 O ticket será deletado em breve...');
        setTimeout(() => i.channel.delete().catch(() => {}), 5000);
    }
});

client.login(TOKEN);
