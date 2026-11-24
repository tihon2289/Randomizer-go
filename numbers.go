package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"math/big"
	mathrand "math/rand/v2"
	"strconv"
	"strings"
	"unicode"
)

func parseNumbers(text string) ([]int64, error) {
	tokens := strings.FieldsFunc(text, func(r rune) bool {
		return unicode.IsSpace(r) || r == ',' || r == ';'
	})
	values := make([]int64, 0, len(tokens))
	for _, token := range tokens {
		normalized := token
		if rest, ok := strings.CutPrefix(token, "−"); ok {
			normalized = "-" + rest
		}
		number, err := strconv.ParseInt(normalized, 10, 64)
		if err != nil {
			preview := []rune(token)
			if len(preview) > 24 {
				preview = append(preview[:24], '…')
			}
			return nil, fmt.Errorf("проверь «%s». Допустимы целые числа от −9 223 372 036 854 775 808 до 9 223 372 036 854 775 807", string(preview))
		}
		values = append(values, number)
	}
	return values, nil
}

func queueID(queue []int64) string {
	digest := sha256.New()
	var word [8]byte
	for _, number := range queue {
		binary.BigEndian.PutUint64(word[:], uint64(number))
		_, _ = digest.Write(word[:])
	}
	return hex.EncodeToString(digest.Sum(nil))
}

func drawNumber(pool, queue []int64, response *numberResponse) error {
	var number int64
	if response.Position < len(queue) {
		number = queue[response.Position]
		response.Position++
	} else {
		index, err := rand.Int(rand.Reader, big.NewInt(int64(len(pool))))
		if err != nil {
			return err
		}
		number = pool[index.Int64()]
	}
	response.Number = strconv.FormatInt(number, 10)

	if len(pool) > 0 {
		response.Frames = make([]string, 11)
		for i := range response.Frames {
			response.Frames[i] = strconv.FormatInt(pool[mathrand.IntN(len(pool))], 10)
		}
	}
	return nil
}
