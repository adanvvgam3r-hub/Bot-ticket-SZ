const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, REST, Routes,
    Collection
} = require('discord.js');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

// --- CONFIGURAÇÕES ---
const TOKEN = process.env.DISCORD_TOKEN;
const ID_CARGO_STAFF = '1452822605773148312'; 
const CANAL_TICKET_POST = '1476773027516518470';
const CANAL_LOGS_DENUNCIA = '1476775424540282934';

const ticketCache = new Collection(); // Armazena a categoria temporariamente

// Segurança contra quedas
process.on('unhandledRejection', error => console.error('Erro detectado:', error));

client.once('ready', async () => {
    const commands = [{
        name: 'setupsz',
        description: 'Posta o painel de tickets Alpha',
        default_member_permissions: PermissionFlagsBits.Administrator.toString()
    }];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`🚀 ALPHA TICKET SYSTEM OPERACIONAL`);
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    
    // 1. SETUP DO PAINEL
    if (i.isChatInputCommand() && i.commandName === 'setupsz') {
        if (i.channelId !== CANAL_TICKET_POST) return i.reply({ content: `❌ Use em <#${CANAL_TICKET_POST}>`, ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE ATENDIMENTO - ALPHA')
            .setDescription('Selecione a categoria e clique no botão para iniciar um **Tópico Privado de Coleta**.\n\n⚠️ *Apenas você e o bot verão a primeira etapa.*')
            .setColor('#2b2d31');

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('selecionar_categoria').setPlaceholder('Escolha o motivo do contato...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'BAN', emoji: '🔨' },
                    { label: 'FALHA EM AP', value: 'AP', emoji: '💰' },
                    { label: 'FALHA EM SIMU', value: 'SIMU', emoji: '🏆' }
                ])
        );

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('abrir_tkt').setLabel('ABRIR TICKET').setStyle(ButtonStyle.Success).setEmoji('📩')
        );

        await i.reply({ content: '✅ Painel enviado!', ephemeral: true });
        return i.channel.send({ embeds: [embed], components: [menu, btn] });
    }

    // 2. SELEÇÃO DE CATEGORIA (CACHE)
    if (i.isStringSelectMenu() && i.customId === 'selecionar_categoria') {
        ticketCache.set(i.user.id, i.values[0]);
        return i.reply({ content: `✅ Você selecionou: **${i.values[0]}**. Agora clique no botão verde.`, ephemeral: true });
    }

    // 3. ABERTURA DO TÓPICO DE COLETA (USER + BOT)
    if (i.isButton() && i.customId === 'abrir_tkt') {
        const cat = ticketCache.get(i.user.id);
        if (!cat) return i.reply({ content: '❌ Selecione uma categoria no menu primeiro!', ephemeral: true });

        const threadSolo = await i.channel.threads.create({
            name: `coleta-${cat.toLowerCase()}-${i.user.username}`,
            type: ChannelType.PrivateThread,
            autoArchiveDuration: 60
        });

        await threadSolo.members.add(i.user.id);
        
        const btnForm = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`form_${cat}`).setLabel('PREENCHER FORMULÁRIO').setStyle(ButtonStyle.Primary)
        );

        await threadSolo.send({ content: `👋 ${i.user}, você iniciou um ticket de **${cat}**. Clique abaixo:`, components: [btnForm] });
        return i.reply({ content: `✅ Tópico privado criado: ${threadSolo}`, ephemeral: true });
    }

    // 4. DISPARAR MODAL
    if (i.isButton() && i.customId.startsWith('form_')) {
        const cat = i.customId.split('_')[1];
        const modal = new ModalBuilder().setCustomId(`modal_${cat}`).setTitle(`RELATÓRIO: ${cat}`);
        
        const qm = new TextInputBuilder().setCustomId('quem').setLabel("QUEM FOI?").setPlaceholder("Ex: @picles").setStyle(TextInputStyle.Short).setRequired(true);
        const relato = new TextInputBuilder().setCustomId('relato').setLabel("EXPLIQUE O OCORRIDO").setStyle(TextInputStyle.Paragraph).setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(qm), new ActionRowBuilder().addComponents(relato));
        return await i.showModal(modal);
    }

    // 5. ENVIO PARA LOGS E TÓPICO STAFF (PÚBLICO PARA EQUIPE)
    if (i.type === InteractionType.ModalSubmit && i.customId.startsWith('modal_')) {
        const cat = i.customId.split('_')[1];
        const quem = i.fields.getTextInputValue('quem');
        const relato = i.fields.getTextInputValue('relato');

        const embedLog = new EmbedBuilder()
            .setTitle(`📝 NOVA OCORRÊNCIA: ${cat}`)
            .addFields(
                { name: '🗂️ Tipo:', value: `\`${cat}\``, inline: true },
                { name: '👤 Acusado:', value: `\`${quem}\``, inline: true },
                { name: '👤 Autor:', value: `<@${i.user.id}>`, inline: true },
                { name: '📝 Relato:', value: `\`\`\`${relato}\`\`\`` }
            )
            .setColor('#f1c40f').setTimestamp();

        const logChannel = i.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        if (logChannel) {
            const msgLog = await logChannel.send({ content: `🚨 **NOVO TICKET [${cat}]** | <@&${ID_CARGO_STAFF}>`, embeds: [embedLog] });

            const threadStaff = await msgLog.startThread({
                name: `${cat.toLowerCase()}-${i.user.username}`,
                autoArchiveDuration: 60,
                type: ChannelType.PublicThread
            });

            await threadStaff.members.add(i.user.id); // Adiciona o player no canal da Staff
            
            const rowClose = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('encerrar_caso').setLabel('ENCERRAR CASO').setStyle(ButtonStyle.Danger)
            );

            await threadStaff.send({ 
                content: `🛠️ **SISTEMA STAFF** | <@&${ID_CARGO_STAFF}>\nO jogador <@${i.user.id}> está neste tópico. Analisem o relato acima.`,
                components: [rowClose]
            });
        }

        await i.reply('✅ Relatório enviado! A Staff analisará e falará com você no tópico de logs. Este tópico de coleta será fechado.');
        setTimeout(() => i.channel.delete().catch(() => {}), 3000);
    }

    // 6. FECHAMENTO FINAL
    if (i.isButton() && i.customId === 'encerrar_caso') {
        await i.reply('🔒 Arquivando e deletando atendimento em 5 segundos...');
        setTimeout(() => i.channel.delete().catch(() => {}), 5000);
    }
});

client.login(TOKEN);
