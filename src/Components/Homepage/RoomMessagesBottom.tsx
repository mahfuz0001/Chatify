import {
  Box,
  Button,
  Center,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  useToast,
} from "@chakra-ui/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BsSend } from "react-icons/bs";
import { IoImagesSharp } from "react-icons/io5";
import { useParams } from "react-router";
import useRoomStore from "../../Store/roomStore";
import useAuthStore from "../../Store/authStore";
import { supabase } from "../../supabaseClient";
import useIsUserBlocked from "../Hooks/useIsUserBlocked";
import { Controller, useForm } from "react-hook-form";
import { createImageMessage, createMessage } from "../../Services/APIs";
import Picker from "emoji-picker-react";

interface FormData {
  message: string;
}

export interface CreateMessage {
  created_at: Date;
  content: string;
  room: number | undefined;
  user: string | undefined;
}

const acceptedFileExtensions = ["png", "jpeg", "jpg"];

const RoomMessagesBottom = () => {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const rooms = useRoomStore((state) => state.rooms);
  const session = useAuthStore((state) => state.session);

  const { register, getValues } = useForm();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [pickEmoji, setPickEmoji] = useState(false);

  if (!id) return <></>;

  const actualRoom = rooms.find((roomState) => roomState.room === parseInt(id));
  const channels = supabase.getChannels();
  const addMessageToRoom = useRoomStore((state) => state.addMessageToRoom);
  const isUserBlocked = useIsUserBlocked(actualRoom?.room);
  const getChannelRoom = channels.find(
    (chan) => chan.topic.split(":")[1] === `room${id.toString()}`
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { handleSubmit, control, setValue } = useForm<FormData>({
    defaultValues: {
      message: "",
    },
  });
  const onSubmit = async (formData: FormData) => {
    const content = formData.message;
    const newMessage = {
      created_at: new Date().toISOString(),
      content,
      room: actualRoom?.room,
      user: session?.user.id,
      isBlocked: isUserBlocked.isRoomBlocked,
    };
    try {
      if (content === "") throw new Error("Write something bitch!!!");
      const message = await createMessage(newMessage);
      addMessageToRoom(message);
      if (getChannelRoom !== undefined && !!message?.isBlocked === false) {
        getChannelRoom.send({
          type: "broadcast",

          event: "message",

          payload: { message },
        });
      }
      setValue("message", "");
      if (getChannelRoom !== undefined) {
        getChannelRoom.untrack();
      }
    } catch (error: any) {
      toast({
        title: "Error:",
        description: error.error_description || error.message,
        status: "error",
        position: "top-right",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const sendImage = async (image: File | undefined) => {
    const file = image;
    if (file !== undefined) {
      const fileExt = file.type.split("/")[1];
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const newMessage = {
        created_at: new Date().toISOString(),
        content: "",
        room: parseInt(id),
        user: session?.user.id,
      };

      try {
        if (!acceptedFileExtensions.includes(fileExt))
          throw Error("You need to upload a correct image(PNG, JPEG)!");
        const { error: uploadError, data: imageData } = await supabase.storage
          .from("users-images")
          .upload(filePath, file, {
            contentType: `image/${fileExt}`,
          });

        if (uploadError) {
          throw uploadError;
        }

        const message = await createMessage(newMessage);
        if (message !== undefined) {
          const imageUrl = imageData?.path;
          const newImage = {
            created_at: new Date().toISOString(),
            message_id: message.id,
            message_room_id: parseInt(id),
            message_user_id: session?.user.id,
            url: imageUrl!,
          };
          const image = await createImageMessage(newImage);
          const newMessage = {
            ...message,
            images: [image],
          };
          addMessageToRoom(newMessage);
          if (getChannelRoom !== undefined) {
            getChannelRoom.send({
              type: "broadcast",

              event: "message",

              payload: {
                message: newMessage,
              },
            });
          }
        }
      } catch (error: any) {
        toast({
          title: "Error:",
          status: "error",
          position: "top-right",
          duration: 3000,
          isClosable: true,
          description: error.error_description || error.message,
        });
      }
    }
  };

  // Get image from user gallery
  const pickImageAsync = async () => {
    if (inputRef.current !== null) {
      inputRef.current.click();
    }
  };

  const onEmojiClick = (event: any, emojiObject: any) => {
    setValue("message", getValues("message") + emojiObject.emoji);
  };

  const listener = (e: any) => {
    setPickEmoji(false);
  };

  useEffect(() => {
    document.body.addEventListener("click", listener);
    return () => {
      document.body.removeEventListener("click", listener);
    };
  }, []);

  return (
    <Box
      id="hook-form"
      onSubmit={handleSubmit(onSubmit)}
      as={"form"}
      position="absolute"
      bottom="0"
      p="2"
      left="0"
      bg={"headerMenuColor"}
      px="4"
      py="3"
      w="full"
      gridArea={"bottom"}
    >
      <HStack
        width="full"
        height="10"
        borderRadius="full"
        position="relative"
        flexDir={"row"}
        spacing="2"
      >
        <InputGroup size="md">
          <Controller
            name="message"
            control={control}
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                variant="unstyled"
                flex="1"
                py="1"
                pr="100px"
                bg={"headerMenuColor"}
                borderColor={"secondaryColor"}
                shadow="3"
                color="white"
                borderRadius="full"
                placeholder="Message"
                fontSize={"md"}
                onChange={(e) => {
                  onChange(e.target.value);
                  if (
                    getChannelRoom !== undefined &&
                    actualRoom !== undefined &&
                    !isUserBlocked.isRoomBlocked
                  ) {
                    getChannelRoom.track({
                      isTyping: Date.now(),
                      room: actualRoom.room,
                    });
                  }
                }}
                onKeyPress={() => {
                  if (
                    getChannelRoom !== undefined &&
                    actualRoom !== undefined &&
                    !isUserBlocked.isRoomBlocked
                  ) {
                    getChannelRoom.track({
                      isTyping: Date.now(),
                      room: actualRoom.room,
                    });
                  }
                }}
                value={value}
                onBlur={() => {
                  onBlur();
                  if (getChannelRoom !== undefined) {
                    // Untrack presence when typying
                    getChannelRoom.untrack();
                  }
                }}
              />
            )}
          />

          <InputRightElement width="100px" h="full">
            <HStack spacing="1" w="full" h="full" alignItems="center">
              <Center
                w="full"
                h="full"
                borderRadius={"full"}
                onClick={pickImageAsync}
                cursor="pointer"
                _pressed={{
                  bg: "lineBreakColor",
                }}
              >
                <Icon as={IoImagesSharp} color="gray.500" size={6} />
              </Center>
              {/* emoji */}
              {/* 
              {pickEmoji && (
                <div
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="absolute w-fit bottom-20 z-50"
                >
                  <Picker onEmojiClick={onEmojiClick} />
                </div>
              )}
              <button
                onClick={(e) => {
                  setPickEmoji(true);
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="ml-3 flex items-center justify-center text-indigo-700 font-semibold p-3 border border-transparent text-sm  rounded-md  bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 bg-opacity-10 hover:bg-opacity-20 mr-2"
              >
                🙂
              </button>
              */}
              <Button
                height="full"
                w="full"
                borderRadius={"full"}
                bg={"accentColor"}
                cursor="pointer"
                type="submit"
                form="hook-form"
                _hover={{
                  background: "accentColorHover",
                }}
                _pressed={{
                  background: "accentColorHover",
                }}
              >
                <Center height="full" width="full">
                  <Icon as={BsSend} color="white" boxSize={4} />
                </Center>
              </Button>
              <input
                style={{ display: "none" }}
                type="file"
                onChange={(e) => {
                  if (e.target.files) {
                    sendImage(e.target.files[0]);
                  }
                }}
                accept="image/png, image/jpeg, image/jpg"
                ref={inputRef}
              />
            </HStack>
          </InputRightElement>
        </InputGroup>
      </HStack>
    </Box>
  );
};

export default RoomMessagesBottom;
